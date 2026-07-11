import "server-only";
import { getStaffUser, getIsAdmin, type StaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Gardes partagées des server actions du back office.
   Défense en profondeur : chaque action re-vérifie la session
   (JWT app_metadata) AVANT toute écriture — le proxy et les
   layouts ne sont que des pré-filtres d'affichage.
   - requireStaffService : contenu (admin + éditeur).
   - requireAdminService : facturation, réglages, utilisateurs,
     suppressions (JWT admin + miroir profiles.role).
   ============================================================ */

export class ActionError extends Error {}

export type GuardedContext = {
  staff: StaffUser;
  service: SupabaseClient;
};

export async function requireStaffService(): Promise<GuardedContext> {
  const staff = await getStaffUser();
  if (!staff) {
    throw new ActionError("Session expirée — reconnectez-vous.");
  }
  const service = serviceClient();
  if (!service) {
    throw new ActionError("Supabase non configuré.");
  }
  return { staff, service };
}

export async function requireAdminService(): Promise<GuardedContext> {
  const { staff, service } = await requireStaffService();
  if (!(await getIsAdmin(staff))) {
    throw new ActionError("Accès réservé aux administrateurs.");
  }
  return { staff, service };
}
