import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import UsersManager, {
  type AdminUserRow,
} from "@/components/admin/users/UsersManager";
import { PageHeading, Notice } from "@/components/admin/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUtilisateursPage() {
  const staff = await requireStaff();
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading
          title="Utilisateurs"
          description="Comptes du back office, administrateurs et éditeurs."
        />
        <Notice tone="warn" title="Supabase non configuré">
          La gestion des comptes est indisponible.
        </Notice>
      </div>
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
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Utilisateurs"
        description="Comptes du back office, administrateurs et éditeurs."
      />
      <UsersManager users={rows} selfId={staff.id} />
    </div>
  );
}
