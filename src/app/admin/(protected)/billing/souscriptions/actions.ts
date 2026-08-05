"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdminService } from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { clientIpFrom } from "@/lib/http/client-ip";
import { createPortalLink, type PortalCabinet } from "@/lib/billing/portal";
import { lookupCabinet } from "@/lib/provisioning";
import { subscribeInviteEmail } from "@/lib/emails/checkout-templates";

/* ============================================================
   Invitation à souscrire — cabinets utilisant déjà le logiciel.

   POURQUOI CETTE ACTION EXISTE : l'espace abonnement s'ouvre normalement
   depuis le logiciel du praticien, mais ce bouton n'existe pas encore côté
   dev B. Sans elle, le lot resterait inutilisable. Elle produit EXACTEMENT le
   même lien que celui que l'application émettra demain : le jour où le bouton
   arrive, rien à changer ici.

   L'identité du cabinet est saisie à la main depuis le back-office de
   l'application (aucune route de recherche n'y est exposée). Elle sert à
   pré-remplir la facturation ; elle ne détermine JAMAIS le prix.

   L'action REND son résultat au lieu de jeter : il n'existe aucun error.tsx
   dans l'application, une exception afficherait donc un écran d'erreur brut
   au lieu d'un message utile.
   ============================================================ */

export type LinkState =
  | { ok: true; url: string; expiresAt: string; notified: boolean }
  | { ok: false; error: string }
  | null;

/* ------------------------------------------------------------
   Recherche d'un cabinet dans l'application.

   Remplace la saisie à la main de l'identifiant technique du cabinet, qui
   était le seul moyen tant que l'application n'exposait aucune route de
   lecture. Un identifiant mal recopié rattachait l'abonnement — donc le
   prélèvement — au mauvais cabinet.
   ------------------------------------------------------------ */

export type FoundCabinet = {
  id: string;
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  invoicePrefix: string;
  siretNumber: string;
  adminName: string;
  adminEmail: string;
  /** Abonnement déjà connu de l'application, pour prévenir les doublons. */
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
};

export type SearchState =
  | { ok: true; cabinet: FoundCabinet }
  /* `title` accompagne TOUJOURS le message : l'écran affichait « Cabinet
     introuvable » en titre au-dessus de n'importe quel refus, y compris
     « ce cabinet a été supprimé » — deux phrases qui se contredisent, et un
     lecteur qui ne sait plus laquelle croire. */
  | { ok: false; title: string; error: string }
  | null;

export async function rechercherCabinet(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  try {
    await requireAdminService();

    const query = String(formData.get("query") ?? "").trim();
    if (!query) {
      return {
        ok: false,
        title: "Recherche vide",
        error: "Saisissez l'email ou l'identifiant du cabinet.",
      };
    }

    /* Une adresse email est reconnue à son arobase ; tout le reste est traité
       comme un identifiant, ce qui laisse le collage direct fonctionner. */
    const outcome = await lookupCabinet(
      query.includes("@") ? { email: query } : { id: query },
    );

    if (!outcome.ok) {
      if (outcome.notFound) {
        return {
          ok: false,
          title: "Cabinet introuvable",
          error:
            "Aucun cabinet ne correspond. Vérifiez l'adresse, ou collez l'identifiant relevé dans le back-office de l'application.",
        };
      }
      /* Trois situations très différentes, trois titres : un cabinet supprimé
         demande une intervention, une application injoignable demande de
         réessayer, une clé refusée demande un administrateur. Les confondre
         sous « introuvable » envoyait chercher une faute de frappe qui
         n'existait pas. */
      return {
        ok: false,
        title: outcome.deleted
          ? "Cabinet supprimé dans l'application"
          : "Recherche impossible",
        error: outcome.reason,
      };
    }

    const c = outcome.cabinet;
    const admin = c.admin;
    return {
      ok: true,
      cabinet: {
        id: c.id,
        name: c.name ?? "",
        email: c.email ?? "",
        address: c.address ?? "",
        postalCode: c.postalCode ?? "",
        city: c.city ?? "",
        invoicePrefix: c.invoicePrefix ?? "",
        siretNumber: c.siretNumber ?? "",
        adminName: admin ? `${admin.firstName} ${admin.lastName}`.trim() : "",
        adminEmail: admin?.email ?? c.email ?? "",
        subscriptionPlan: c.subscriptionPlan,
        subscriptionStatus: c.subscriptionStatus,
      },
    };
  } catch (err) {
    console.error(
      "[souscriptions] recherche :",
      err instanceof Error ? err.message : String(err),
    );
    return {
      ok: false,
      title: "Recherche impossible",
      error: "La recherche a échoué. Réessayez.",
    };
  }
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

export async function creerLienSouscription(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  let staffId = "";
  let staffEmail = "";

  try {
    const { staff, service } = await requireAdminService();
    staffId = staff.id;
    staffEmail = staff.email;

    const cabinetId = field(formData, "cabinetId");
    const cabinet: PortalCabinet = {
      name: field(formData, "name"),
      email: field(formData, "email"),
      address: field(formData, "address"),
      postalCode: field(formData, "postalCode"),
      city: field(formData, "city"),
      invoicePrefix: field(formData, "invoicePrefix"),
      siretNumber: field(formData, "siretNumber") || undefined,
      adminEmail: field(formData, "adminEmail") || field(formData, "email"),
      adminName: field(formData, "adminName"),
    };

    if (!cabinetId) {
      return {
        ok: false,
        error:
          "L'identifiant du cabinet dans l'application est obligatoire : c'est lui qui rattache l'abonnement au bon compte.",
      };
    }
    if (!cabinet.name || !cabinet.adminEmail) {
      return {
        ok: false,
        error: "Le nom du cabinet et l'email de l'administrateur sont obligatoires.",
      };
    }
    /* Sans adresse complète, la facture serait incomplète (mentions
       obligatoires) et le contexte 3-D Secure partirait vide. */
    if (!cabinet.address || !cabinet.postalCode || !cabinet.city) {
      return {
        ok: false,
        error:
          "L'adresse complète est obligatoire : elle figure sur la facture et sert au contrôle 3-D Secure.",
      };
    }

    /* SECONDE VÉRIFICATION, à l'instant d'engager. La recherche a pu avoir lieu
       il y a dix minutes, et le formulaire porte des champs modifiables : rien
       ne garantit que l'identifiant soumis est celui qui a été contrôlé. On
       redemande donc l'état du cabinet à l'application juste avant d'ouvrir la
       caisse — c'est le dernier moment où le refus ne coûte rien. */
    const etat = await lookupCabinet({ id: cabinetId });
    if (!etat.ok) {
      return {
        ok: false,
        error: etat.notFound
          ? "Ce cabinet n'existe plus dans l'application : aucun lien ne peut être créé."
          : etat.reason,
      };
    }

    const { url, expiresAt } = await createPortalLink(service, {
      appCabinetId: cabinetId,
      cabinet,
      createdVia: "admin",
      createdBy: staffId,
      clientIp: clientIpFrom(await headers()),
    });

    /* Le lien expire en 15 minutes : l'envoyer par email le rendrait
       inutilisable le temps que le praticien ouvre sa boîte. On prévient donc
       SANS le lien (le message annonce l'appel), et l'admin le transmet par un
       canal immédiat. */
    const notify = field(formData, "notify") === "on";
    if (notify) {
      try {
        const mail = subscribeInviteEmail({
          adminFirstName: cabinet.adminName.trim().split(/\s+/)[0] ?? "",
          cabinetName: cabinet.name,
        });
        await sendMail({ to: cabinet.adminEmail, ...mail });
      } catch (err) {
        console.error(
          "[souscriptions] échec email d'invitation :",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    await logAudit({
      action: "billing.subscribe_link_created",
      entityType: "portal_link",
      entityId: cabinetId,
      diff: { cabinetName: cabinet.name, notified: notify },
      actorId: staffId,
      actorEmail: staffEmail,
    });

    revalidatePath("/admin/billing/souscriptions");
    return { ok: true, url, expiresAt: expiresAt.toISOString(), notified: notify };
  } catch (err) {
    console.error(
      "[souscriptions] création du lien :",
      err instanceof Error ? err.message : String(err),
    );
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "ActionError"
          ? err.message
          : "Le lien n'a pas pu être créé. Vérifiez la configuration puis réessayez.",
    };
  }
}
