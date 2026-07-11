import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   DAL d'authentification du back office.
   Le rôle autoritaire vit dans app_metadata du JWT (cf. 0002) ;
   profiles.role n'est qu'un miroir UI. Toute page ou action du
   back office DOIT passer par requireStaff — le proxy n'est
   qu'un pré-filtre optimiste.
   ============================================================ */

export type StaffRole = "admin" | "editor";

export type StaffUser = {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
};

/** Utilisateur staff de la requête, ou null. Mémoïsé par requête. */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const sb = await serverClient();
  if (!sb) return null;

  const { data } = await sb.auth.getUser();
  const user = data.user;
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || (role !== "admin" && role !== "editor")) return null;

  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    displayName:
      (user.user_metadata?.display_name as string | undefined) ??
      email.split("@")[0],
    role,
  };
});

/** Garde des pages/actions admin : redirige vers le login sinon. */
export async function requireStaff(): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff) redirect("/admin/login");
  return staff;
}

/** Vrai si le staff est admin selon le JWT ET le miroir profiles.role
 *  (défense en profondeur : un rôle retiré depuis la dernière émission
 *  du JWT ferme l'accès). Mémoïsé par requête. */
export const getIsAdmin = cache(async (staff: StaffUser): Promise<boolean> => {
  if (staff.role !== "admin") return false;
  const service = serviceClient();
  if (!service) return true; /* pas de service key : le JWT fait foi */
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", staff.id)
    .maybeSingle();
  return !profile || profile.role === "admin";
});
