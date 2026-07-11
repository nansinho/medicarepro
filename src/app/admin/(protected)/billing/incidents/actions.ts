"use server";

import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/* ============================================================
   Actions des incidents billing. Défense en profondeur : chaque
   action re-vérifie l'utilisateur (JWT via serverClient) ET le
   miroir profiles.role='admin' AVANT toute écriture, puis écrit
   via le service client.
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
 * Relance le provisioning d'un dossier payé : repose next_retry_at à
 * maintenant. Le worker (cron provision-retry) garde l'EXCLUSIVITÉ du
 * POST vers l'app — l'action ne provisionne jamais elle-même.
 */
export async function relancerProvisioning(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff, service } = await requireAdminService();

  const { error } = await service
    .from("pending_signups")
    .update({ next_retry_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "paid");

  if (error) {
    throw new ActionError(`Relance impossible : ${error.message}`);
  }

  await logAudit({
    action: "admin.provisioning.retry",
    entityType: "pending_signups",
    entityId: id,
    actorId: staff.id,
    actorEmail: staff.email,
  });

  revalidatePath("/admin/billing/incidents");
  revalidatePath("/admin");
}

/**
 * Marque un incident comme résolu (dossier abandonné ou remboursé
 * manuellement) : status='abandoned'. Le paid_at non-null protège la
 * ligne du DELETE de la purge des dossiers jamais payés.
 */
export async function marquerResolu(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff, service } = await requireAdminService();

  const { error } = await service
    .from("pending_signups")
    .update({ status: "abandoned" })
    .eq("id", id)
    .in("status", ["failed_conflict", "amount_mismatch", "duplicate_paid", "paid"]);

  if (error) {
    throw new ActionError(`Résolution impossible : ${error.message}`);
  }

  await logAudit({
    action: "admin.incident.resolved",
    entityType: "pending_signups",
    entityId: id,
    diff: { status: "abandoned" },
    actorId: staff.id,
    actorEmail: staff.email,
  });

  revalidatePath("/admin/billing/incidents");
  revalidatePath("/admin");
}
