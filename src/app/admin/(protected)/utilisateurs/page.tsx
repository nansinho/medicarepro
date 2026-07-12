import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import UsersManager, {
  type AdminUserRow,
} from "@/components/admin/users/UsersManager";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUtilisateursPage() {
  const staff = await requireStaff();
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Utilisateurs</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : la gestion des comptes est indisponible.
        </p>
      </>
    );
  }

  /* Miroir profiles (rôle UI) + état auth (bannissement, confirmation,
     dernière connexion) via l'API admin GoTrue. */
  const [{ data: profiles }, { data: authList }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, display_name, role, created_at")
      .order("created_at", { ascending: true }),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);

  const authById = new Map(
    (authList?.users ?? []).map((user) => [user.id, user]),
  );

  const rows: AdminUserRow[] = (profiles ?? []).map((profile) => {
    const auth = authById.get(profile.id);
    const bannedUntil = (auth as { banned_until?: string } | undefined)
      ?.banned_until;
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name ?? profile.email.split("@")[0],
      role: profile.role === "admin" ? "admin" : "editor",
      confirmed: Boolean(auth?.email_confirmed_at),
      banned: Boolean(bannedUntil && new Date(bannedUntil) > new Date()),
      lastSignInAt: auth?.last_sign_in_at ?? null,
      createdAt: profile.created_at,
    };
  });

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Utilisateurs</h1>
        <p className={s.pageDesc}>
          Comptes du back office — administrateurs et éditeurs.
        </p>
      </header>
      <UsersManager users={rows} selfId={staff.id} />
    </>
  );
}
