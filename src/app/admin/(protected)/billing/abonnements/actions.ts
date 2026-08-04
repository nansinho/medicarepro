"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { stopRecurrence } from "@/lib/billing/recurrence";
import {
  activeChange,
  withdrawChange,
  CHANGEABLE_SUBSCRIPTION_COLUMNS,
  type ChangeableSubscription,
} from "@/lib/billing/changes";

/* ============================================================
   Actions d'un abonnement. Même défense en profondeur que les
   incidents : l'utilisateur est re-vérifié (JWT + miroir
   profiles.role='admin') AVANT tout appel bancaire.
   ============================================================ */

class ActionError extends Error {}

async function requireAdminService() {
  const staff = await getStaffUser();
  if (!staff || staff.role !== "admin") {
    throw new ActionError("Accès réservé aux administrateurs.");
  }
  const service = serviceClient();
  if (!service) {
    throw new ActionError("Supabase non configuré.");
  }
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", staff.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    throw new ActionError("Accès réservé aux administrateurs.");
  }
  return { staff, service };
}

/**
 * Arrête la reconduction automatique auprès de Monetico.
 *
 * Rien n'est enregistré sans accusé bancaire positif (cf. stopRecurrence) : un
 * refus laisse l'abonnement actif, visible, et déclenche une alerte interne.
 *
 * L'abonnement n'est PAS marqué résilié pour autant : la période déjà réglée
 * lui est due, et le statut ne bascule qu'à son terme (cron quotidien). Arrêter
 * la reconduction et résilier sont deux faits distincts.
 */
export async function arreterReconduction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff } = await requireAdminService();

  const outcome = await stopRecurrence(id);

  await logAudit({
    action: outcome.ok
      ? "admin.recurrence.stopped"
      : "admin.recurrence.stop_failed",
    entityType: "subscriptions",
    entityId: id,
    diff: { lib: outcome.lib },
    actorId: staff.id,
    actorEmail: staff.email,
  });

  revalidatePath(`/admin/billing/abonnements/${id}`);
  revalidatePath("/admin/billing/abonnements");

  if (!outcome.ok) {
    throw new ActionError(outcome.message);
  }
}

/**
 * Retire la demande en attente d'un praticien (changement de formule, de carte,
 * ou résiliation), depuis le back-office.
 *
 * ⚠️ CE QUE ÇA NE REND PAS : la reconduction automatique. L'arrêt envoyé à
 * Monetico au moment de la demande est définitif, aucun service ne le rejoue.
 * Le contrat garde donc sa formule, mais devra être repayé à l'échéance. C'est
 * la même règle que dans l'espace du praticien, et le client en est informé
 * par email.
 */
export async function retirerDemande(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff, service } = await requireAdminService();

  const { data: subData } = await service
    .from("subscriptions")
    .select(CHANGEABLE_SUBSCRIPTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!subData) throw new ActionError("Abonnement introuvable.");

  const change = await activeChange(service, id);
  if (!change) throw new ActionError("Aucune demande en attente.");

  const outcome = await withdrawChange({
    subscription: subData as ChangeableSubscription,
    change,
    via: "admin",
    requestedByAdmin: staff.id,
  });

  revalidatePath(`/admin/billing/abonnements/${id}`);
  revalidatePath("/admin/billing/abonnements");

  if (!outcome.ok) {
    throw new ActionError(outcome.error);
  }
}
