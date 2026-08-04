"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdminService } from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { clientIpFrom } from "@/lib/http/client-ip";
import { createPortalLink, type PortalCabinet } from "@/lib/billing/portal";
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
