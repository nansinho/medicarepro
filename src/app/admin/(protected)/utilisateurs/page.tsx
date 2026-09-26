import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { NotConfigured } from "@/components/admin/kit/states";
import UsersView, { type MemberRow } from "@/components/admin/users/UsersView";
import { memberStatus } from "@/components/admin/users/member-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUtilisateursPage() {
  const staff = await requireStaff();
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Utilisateurs" />
        <NotConfigured scope="La gestion des comptes" />
      </PageStack>
    );
  }

  /* Miroir profiles (nom, rôle UI) + état auth (confirmation, envoi de
     l'invitation, bannissement, dernière connexion) via l'API GoTrue. */
  const [{ data: profiles }, { data: authList }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, display_name, role, created_at")
      .order("created_at", { ascending: true }),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);

  const authById = new Map((authList?.users ?? []).map((user) => [user.id, user]));

  /* Page dynamique : l'heure de la requête est exactement ce qu'on veut ici. */
  const now = new Date();

  const members: MemberRow[] = (profiles ?? []).map((profile) => {
    const auth = authById.get(profile.id);
    const { status, inviteExpiresAt } = memberStatus(
      {
        email_confirmed_at: auth?.email_confirmed_at ?? null,
        banned_until: (auth as { banned_until?: string } | undefined)?.banned_until ?? null,
        confirmation_sent_at: auth?.confirmation_sent_at ?? null,
        invited_at: auth?.invited_at ?? null,
      },
      now,
    );
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name ?? profile.email.split("@")[0],
      role: profile.role === "admin" ? "admin" : "editor",
      status,
      inviteExpiresAt,
      lastSignInAt: auth?.last_sign_in_at ?? null,
    };
  });

  /* Les invitations à relancer d'abord, puis les actifs, puis les
     désactivés : l'œil tombe sur ce qui demande un geste. */
  const ORDER: Record<MemberRow["status"], number> = {
    invite_expired: 0,
    invited: 1,
    active: 2,
    disabled: 3,
  };
  members.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return <UsersView members={members} selfId={staff.id} />;
}
