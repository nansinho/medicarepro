"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { stopRecurrence } from "@/lib/billing/recurrence";

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
 * La souscription n'est marquée résiliée que sur accusé bancaire positif
 * (cf. stopRecurrence) : un refus laisse l'abonnement actif, visible, et
 * déclenche une alerte interne.
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
