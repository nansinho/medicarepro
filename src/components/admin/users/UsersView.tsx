import { Users } from "lucide-react";
import { PageHeader, PageStack, PageColumns } from "@/components/admin/kit/layout";
import { EmptyState } from "@/components/admin/kit/states";
import DataTable from "@/components/admin/kit/DataTable";
import NewMemberForm from "@/components/admin/users/NewMemberForm";
import MemberRoleSelect from "@/components/admin/users/MemberRoleSelect";
import MemberRowActions from "@/components/admin/users/MemberRowActions";
import {
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_VARIANT,
  type MemberStatus,
} from "@/components/admin/users/member-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================================================
   Écran « Utilisateurs » : l'affichage seul, sans lecture de base.

   MÊME GRAMMAIRE QU'« ACCÈS OFFERTS » : l'action et la liste à gauche,
   les règles du jeu dans le rail. L'ancien écran empilait un formulaire
   à sélecteurs natifs (dont un « mode » qui changeait le sens du bouton),
   une confirmation du navigateur au milieu de l'écran, et n'offrait aucun
   moyen de renvoyer ou d'annuler une invitation.
   ============================================================ */

export type MemberRow = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor";
  status: MemberStatus;
  inviteExpiresAt: string | null;
  lastSignInAt: string | null;
};

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Monogramme d'avatar (2 lettres) dérivé du nom affiché. */
function monogram(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase() || "?";
}

function statusDetail(row: MemberRow): string | null {
  if (row.status === "invited" && row.inviteExpiresAt) {
    return `Lien valable jusqu'au ${dateTimeFmt.format(new Date(row.inviteExpiresAt))}`;
  }
  if (row.status === "invite_expired") return "Renvoyez-la pour un nouveau lien";
  return null;
}

export default function UsersView({
  members,
  selfId,
}: {
  members: MemberRow[];
  selfId: string;
}) {
  const count = (status: MemberStatus) => members.filter((m) => m.status === status).length;
  const actifs = count("active");
  const enAttente = count("invited") + count("invite_expired");
  const admins = members.filter((m) => m.role === "admin" && m.status === "active").length;

  return (
    <PageStack>
      <PageHeader
        title="Utilisateurs"
        description="L'équipe qui gère le site et la facturation : invitations, rôles, accès."
      />

      <PageColumns
        aside={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Comment se passe une invitation</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2.5 p-5 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <b className="text-foreground">Un lien personnel, 24 heures.</b>{" "}
                  La personne choisit elle-même son mot de passe : personne
                  d&apos;autre ne le connaît. Le lien mène toujours à
                  medicarepro.fr, même envoyé depuis un poste de développement.
                </p>
                <p>
                  <b className="text-foreground">Lien expiré ou email perdu ?</b>{" "}
                  « Renvoyer l&apos;invitation » crée un nouveau lien ; l&apos;ancien
                  cesse aussitôt de fonctionner. Le lien s&apos;affiche aussi ici,
                  pour le transmettre par message.
                </p>
                <p>
                  <b className="text-foreground">Un rôle change à la reconnexion.</b>{" "}
                  La personne garde ses droits actuels jusqu&apos;à sa prochaine
                  connexion.
                </p>
                <p>
                  <b className="text-foreground">Désactiver ou supprimer.</b>{" "}
                  Désactiver coupe l&apos;accès et se réactive d&apos;un clic.
                  Supprimer efface le compte pour de bon : ses pages et articles
                  restent en ligne, et le journal d&apos;audit garde la trace de
                  ce qu&apos;il a fait. Le dernier administrateur ne peut être ni
                  désactivé ni supprimé.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Équipe</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-3 gap-px bg-border">
                {[
                  { label: "Actifs", value: actifs },
                  { label: "En attente", value: enAttente },
                  { label: "Admins actifs", value: admins },
                ].map((k) => (
                  <div key={k.label} className="bg-card px-5 py-4">
                    <div className="font-mono text-xl tabular-nums text-foreground">
                      {k.value}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Inviter un membre</CardTitle>
          </CardHeader>
          <NewMemberForm />
        </Card>

        <Card className="overflow-clip">
          <CardHeader>
            <CardTitle>Membres</CardTitle>
            {members.length > 0 && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {members.length}
              </span>
            )}
          </CardHeader>

          <DataTable
            rows={members}
            getKey={(m) => m.id}
            columns={[
              {
                id: "who",
                header: "Membre",
                role: "grow",
                truncate: true,
                /* Sans plancher, la troncature écrase la colonne à une
                   lettre quand le tableau défile sur mobile. */
                className: "min-w-[240px]",
                title: (m) => m.email,
                cell: (m) => (
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15"
                    >
                      {monogram(m.displayName)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {m.displayName}
                        {m.id === selfId && (
                          <span className="font-normal text-muted-foreground"> · vous</span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </span>
                    </span>
                  </span>
                ),
              },
              {
                id: "role",
                header: "Rôle",
                cell: (m) =>
                  m.id === selfId || m.status === "disabled" ? (
                    <Badge variant={m.role === "admin" ? "blue" : "gray"}>
                      {m.role === "admin" ? "Administrateur" : "Éditeur"}
                    </Badge>
                  ) : (
                    <MemberRoleSelect userId={m.id} email={m.email} role={m.role} />
                  ),
              },
              {
                id: "status",
                header: "État",
                cell: (m) => {
                  const detail = statusDetail(m);
                  return (
                    <span className="flex flex-col items-start gap-1">
                      <Badge variant={MEMBER_STATUS_VARIANT[m.status]}>
                        {MEMBER_STATUS_LABELS[m.status]}
                      </Badge>
                      {detail && (
                        <span className="text-[11px] text-muted-foreground">{detail}</span>
                      )}
                    </span>
                  );
                },
              },
              {
                id: "last",
                header: "Dernière connexion",
                role: "date",
                cell: (m) =>
                  m.lastSignInAt ? dateTimeFmt.format(new Date(m.lastSignInAt)) : "Jamais",
              },
              {
                id: "actions",
                header: <span className="sr-only">Actions</span>,
                role: "fit",
                className: "text-right",
                cell: (m) => (
                  <MemberRowActions
                    userId={m.id}
                    email={m.email}
                    status={m.status}
                    isSelf={m.id === selfId}
                  />
                ),
              },
            ]}
            empty={
              <EmptyState
                icon={Users}
                title="Aucun membre"
                description="Les personnes invitées ci-dessus apparaîtront ici, avec l'état de leur invitation."
              />
            }
            footer={
              <>
                <span>
                  <b className="font-mono tabular-nums text-foreground">{actifs}</b> actif(s)
                </span>
                <span>
                  <b className="font-mono tabular-nums text-foreground">{enAttente}</b>{" "}
                  invitation(s) en attente
                </span>
              </>
            }
          />
        </Card>
      </PageColumns>
    </PageStack>
  );
}
