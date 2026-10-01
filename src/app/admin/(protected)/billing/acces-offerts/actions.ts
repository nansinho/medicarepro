"use server";

import { revalidatePath } from "next/cache";
import { ActionError, requireAdminService } from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { emailLinkUrl } from "@/lib/http/site-url";
import { checkAvailability } from "@/lib/provisioning";
import {
  giftLinkExpiry,
  newGiftToken,
  parseGiftDraft,
} from "@/lib/billing/gift";
import { giftInvitationEmail } from "@/lib/emails/gift-templates";

/* ============================================================
   Accès offerts : émission, renvoi et retrait des invitations.

   LE LIEN EST MONTRÉ UNE FOIS, JAMAIS CONSERVÉ. La base n'en garde que
   l'empreinte : après avoir quitté la page, le seul moyen d'en obtenir un est
   de renvoyer l'invitation, ce qui périme l'ancien. Il part aussi par email ;
   l'afficher sert à le transmettre en plus par un message, ce que le dirigeant
   fait naturellement pour un gagnant de concours.

   Les actions RENDENT leur résultat au lieu de jeter : il n'existe aucun
   error.tsx dans le back-office, une exception afficherait un écran brut.
   ============================================================ */

export type GiftFormState =
  | { ok: true; email: string; link: string; emailSent: boolean; months: number }
  | { ok: false; field?: string; error: string }
  | null;

export type GiftRowState =
  | { ok: true; message: string; link?: string }
  | { ok: false; error: string }
  | null;

/* Domaine public même quand l'invitation part d'un poste de développement :
   le bénéficiaire ouvre le lien chez lui (voir lib/http/site-url). */
function inscriptionLink(token: string): string {
  return emailLinkUrl(`/inscription?invitation=${encodeURIComponent(token)}`);
}

function frDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

async function envoyer(email: string, months: number, link: string, expiresAt: Date): Promise<boolean> {
  try {
    await sendMail({
      to: email,
      ...giftInvitationEmail({
        months,
        link,
        expiresAtLabel: frDate(expiresAt),
      }),
    });
    return true;
  } catch (err) {
    console.error(
      "[acces-offerts] échec d'envoi de l'invitation :",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

function messageDErreur(err: unknown, repli: string): string {
  return err instanceof ActionError ? err.message : repli;
}

/* ------------------------------------------------------------
   Nouvelle invitation.
   ------------------------------------------------------------ */

export async function creerInvitation(
  _prev: GiftFormState,
  formData: FormData,
): Promise<GiftFormState> {
  try {
    const { staff, service } = await requireAdminService();

    const parsed = parseGiftDraft({
      email: formData.get("email"),
      months: formData.get("months"),
      reason: formData.get("reason"),
    });
    if (!parsed.ok) return { ok: false, field: parsed.field, error: parsed.error };
    const draft = parsed.draft;

    /* UNE SEULE INVITATION EN ATTENTE PAR ADRESSE. Deux liens valides pour la
       même personne, c'est deux périodes offertes possibles. */
    const { data: enCours } = await service
      .from("gift_invitations")
      .select("id, expires_at")
      .eq("email", draft.email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (enCours && enCours.length > 0) {
      return {
        ok: false,
        field: "email",
        error:
          "Une invitation est déjà en attente pour cette adresse. Renvoyez-la depuis la liste plutôt que d'en créer une seconde.",
      };
    }

    /* L'ACCÈS OFFERT OUVRE UN NOUVEAU COMPTE. Si l'adresse en a déjà un dans
       le logiciel, le tunnel refuserait l'inscription au dernier moment, face
       au bénéficiaire. On le dit ici, à l'administrateur. Si l'application ne
       répond pas, on n'empêche rien : le tunnel refera le contrôle. */
    try {
      const dispo = await checkAvailability({ user: { email: draft.email } });
      if (!dispo.available && dispo.conflicts.includes("user.email")) {
        return {
          ok: false,
          field: "email",
          error:
            "Cette adresse a déjà un compte dans MediCare Pro. Un accès offert ouvre un nouveau compte : pour un cabinet existant, prolongez son accès depuis le back-office de l'application.",
        };
      }
    } catch {
      /* Application injoignable : contrôle reporté au tunnel. */
    }

    const { token, hash } = newGiftToken();
    const now = new Date();
    const expiresAt = giftLinkExpiry(now);

    const { data: cree, error } = await service
      .from("gift_invitations")
      .insert({
        email: draft.email,
        months: draft.months,
        reason: draft.reason,
        /* Jamais de carte demandée : la colonne, obligatoire en base, ne garde
           plus que cette valeur. */
        require_card: false,
        token_hash: hash,
        expires_at: expiresAt.toISOString(),
        created_by: staff.id,
        created_by_email: staff.email,
        sent_count: 1,
        last_sent_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (error || !cree) {
      console.error("[acces-offerts] insertion :", error?.message);
      return { ok: false, error: "L'invitation n'a pas pu être enregistrée. Réessayez." };
    }

    const link = inscriptionLink(token);
    const emailSent = await envoyer(draft.email, draft.months, link, expiresAt);

    await logAudit({
      action: "billing.gift_invitation_created",
      entityType: "gift_invitation",
      entityId: (cree as { id: string }).id,
      diff: {
        email: draft.email,
        months: draft.months,
        reason: draft.reason,
        emailSent,
      },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    revalidatePath("/admin/billing/acces-offerts");
    return { ok: true, email: draft.email, link, emailSent, months: draft.months };
  } catch (err) {
    console.error(
      "[acces-offerts] création :",
      err instanceof Error ? err.message : String(err),
    );
    return {
      ok: false,
      error: messageDErreur(err, "L'invitation n'a pas pu être créée. Réessayez."),
    };
  }
}

/* ------------------------------------------------------------
   Renvoi : un NOUVEAU lien, l'ancien cesse de fonctionner.
   ------------------------------------------------------------ */

export async function renvoyerInvitation(id: string): Promise<GiftRowState> {
  try {
    const { staff, service } = await requireAdminService();

    const { data } = await service
      .from("gift_invitations")
      .select("id, email, months, status, sent_count")
      .eq("id", id)
      .maybeSingle();
    const inv = data as {
      id: string;
      email: string;
      months: number;
      status: string;
      sent_count: number;
    } | null;
    if (!inv) return { ok: false, error: "Invitation introuvable." };
    if (inv.status !== "pending") {
      return {
        ok: false,
        error:
          inv.status === "claimed"
            ? "Cette invitation a déjà servi : l'accès offert est ouvert."
            : "Cette invitation a été retirée.",
      };
    }

    const { token, hash } = newGiftToken();
    const now = new Date();
    const expiresAt = giftLinkExpiry(now);
    /* La condition `status = pending` est répétée dans la mise à jour : si le
       bénéficiaire s'inscrit à l'instant, on ne remplace pas son lien. */
    const { data: maj, error } = await service
      .from("gift_invitations")
      .update({
        token_hash: hash,
        expires_at: expiresAt.toISOString(),
        sent_count: inv.sent_count + 1,
        last_sent_at: now.toISOString(),
      })
      .eq("id", inv.id)
      .eq("status", "pending")
      .select("id");
    if (error || !maj || maj.length === 0) {
      return { ok: false, error: "L'invitation vient de changer d'état. Rechargez la page." };
    }

    const link = inscriptionLink(token);
    const emailSent = await envoyer(inv.email, inv.months, link, expiresAt);

    await logAudit({
      action: "billing.gift_invitation_resent",
      entityType: "gift_invitation",
      entityId: inv.id,
      diff: { email: inv.email, emailSent },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    revalidatePath("/admin/billing/acces-offerts");
    return {
      ok: true,
      message: emailSent
        ? `Nouveau lien envoyé à ${inv.email}. L'ancien ne fonctionne plus.`
        : `Nouveau lien créé, mais l'email n'est pas parti : transmettez le lien à ${inv.email}.`,
      link,
    };
  } catch (err) {
    return { ok: false, error: messageDErreur(err, "Le renvoi a échoué. Réessayez.") };
  }
}

/* ------------------------------------------------------------
   Retrait : le lien cesse de fonctionner. Sans effet sur un accès déjà
   ouvert, qui se gère comme n'importe quel abonnement.
   ------------------------------------------------------------ */

export async function retirerInvitation(id: string): Promise<GiftRowState> {
  try {
    const { staff, service } = await requireAdminService();
    const { data: maj, error } = await service
      .from("gift_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, email");
    if (error || !maj || maj.length === 0) {
      return {
        ok: false,
        error: "Seule une invitation encore en attente peut être retirée.",
      };
    }
    const inv = maj[0] as { id: string; email: string };

    await logAudit({
      action: "billing.gift_invitation_revoked",
      entityType: "gift_invitation",
      entityId: inv.id,
      diff: { email: inv.email },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    revalidatePath("/admin/billing/acces-offerts");
    return { ok: true, message: `Invitation de ${inv.email} retirée : le lien ne fonctionne plus.` };
  } catch (err) {
    return { ok: false, error: messageDErreur(err, "Le retrait a échoué. Réessayez.") };
  }
}
