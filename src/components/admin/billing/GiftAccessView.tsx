import { Gift } from "lucide-react";
import {
  GIFT_STATE_LABELS,
  type GiftDisplayState,
  type GiftInvitation,
} from "@/lib/billing/gift";
import { PageHeader, PageStack, PageColumns } from "@/components/admin/kit/layout";
import { EmptyState } from "@/components/admin/kit/states";
import DataTable, { CellTitle } from "@/components/admin/kit/DataTable";
import GiftInviteForm from "@/components/admin/billing/GiftInviteForm";
import GiftRowActions from "@/components/admin/billing/GiftRowActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================================================
   Écran « Accès offerts » : l'affichage seul, sans aucune lecture de base.

   Séparé de la page pour que l'écran se relise et se montre sans session
   ni données réelles (aperçu, tests visuels). La page lit la base, calcule
   l'état de chaque invitation, et passe les lignes ici.
   ============================================================ */

/** Une invitation, son contrat s'il existe, et l'état qui en découle. */
export type GiftLigne = {
  invitation: GiftInvitation;
  contrat: { cabinet_name: string; gift_ends_at: string | null } | null;
  etat: GiftDisplayState;
};

const STATE_VARIANT: Record<
  GiftDisplayState,
  "green" | "amber" | "red" | "gray" | "blue"
> = {
  pending: "blue",
  link_expired: "gray",
  revoked: "gray",
  opening: "amber",
  active: "blue",
  converted: "green",
  ended: "gray",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});
const fmt = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "—");

export default function GiftAccessView({ lignes }: { lignes: GiftLigne[] }) {
  const compte = (etat: GiftDisplayState) => lignes.filter((l) => l.etat === etat).length;
  const enAttente = compte("pending");
  const enCours = compte("active") + compte("opening");
  const abonnes = compte("converted");
  const terminees = compte("ended");

  return (
    <PageStack>
      <PageHeader
        title="Accès offerts"
        description="Offrir quelques mois de MediCare Pro : concours, partenariat, geste commercial. Le bénéficiaire reçoit un lien personnel, s'inscrit comme un client et ne paie rien pendant la durée offerte."
      />

      <PageColumns
        aside={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Comment ça se passe</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2.5 p-5 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <b className="text-foreground">Un lien personnel, 60 jours.</b>{" "}
                  Il ne fonctionne qu&apos;avec l&apos;adresse invitée, qui devient
                  l&apos;identifiant de connexion, et ne sert qu&apos;une fois.
                </p>
                <p>
                  <b className="text-foreground">Une inscription normale.</b>{" "}
                  SIRET, cabinet, mot de passe, documents contractuels : le
                  bénéficiaire est un cabinet comme un autre, rien n&apos;est à
                  créer à la main dans l&apos;application.
                </p>
                <p>
                  <b className="text-foreground">Rien n&apos;est prélevé</b>{" "}
                  pendant la période offerte, qui court à partir de
                  l&apos;inscription.
                </p>
                <p>
                  <b className="text-foreground">Rappels automatiques</b>{" "}
                  14, 7
                  et 2 jours avant la fin. Ensuite, selon le choix fait à
                  l&apos;envoi : l&apos;abonnement démarre, ou le compte passe en
                  lecture seule (rien n&apos;est supprimé) et le bénéficiaire est
                  invité à s&apos;abonner. L&apos;équipe est prévenue par email
                  dans ce second cas.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bilan</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-px bg-border">
                {[
                  { label: "En attente", value: enAttente },
                  { label: "Période en cours", value: enCours },
                  { label: "Abonnés ensuite", value: abonnes },
                  { label: "Terminées sans suite", value: terminees },
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
            <CardTitle>Nouvelle invitation</CardTitle>
          </CardHeader>
          <GiftInviteForm />
        </Card>

        <Card className="overflow-clip">
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            {lignes.length > 0 && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {lignes.length}
              </span>
            )}
          </CardHeader>

          <DataTable
            rows={lignes}
            getKey={(l) => l.invitation.id}
            columns={[
              {
                id: "who",
                header: "Bénéficiaire",
                role: "grow",
                truncate: true,
                title: (l) => l.invitation.email,
                cell: (l) => (
                  <CellTitle
                    sub={
                      l.contrat?.cabinet_name
                        ? `${l.contrat.cabinet_name} · ${l.invitation.reason}`
                        : l.invitation.reason
                    }
                  >
                    {l.invitation.email}
                  </CellTitle>
                ),
              },
              {
                id: "months",
                header: "Durée",
                cell: (l) => `${l.invitation.months} mois`,
              },
              {
                id: "end",
                header: "Ensuite",
                cell: (l) =>
                  l.invitation.require_card ? "Abonnement" : "Lecture seule",
              },
              {
                id: "until",
                header: "Offert jusqu'au",
                role: "date",
                cell: (l) => fmt(l.contrat?.gift_ends_at ?? null),
              },
              {
                id: "state",
                header: "État",
                cell: (l) => (
                  <Badge variant={STATE_VARIANT[l.etat]}>
                    {GIFT_STATE_LABELS[l.etat]}
                  </Badge>
                ),
              },
              {
                id: "sent",
                header: "Envoyée le",
                role: "date",
                cell: (l) => fmt(l.invitation.last_sent_at ?? l.invitation.created_at),
              },
              {
                id: "actions",
                header: "",
                role: "fit",
                cell: (l) =>
                  l.invitation.status === "pending" ? (
                    <GiftRowActions id={l.invitation.id} />
                  ) : null,
              },
            ]}
            empty={
              <EmptyState
                icon={Gift}
                title="Aucune invitation"
                description="La première invitation envoyée ci-dessus apparaîtra ici, avec son suivi jusqu'à l'abonnement."
              />
            }
            footer={
              <>
                <span>
                  <b className="font-mono tabular-nums text-foreground">{enAttente}</b>{" "}
                  en attente
                </span>
                <span>
                  <b className="font-mono tabular-nums text-foreground">{enCours}</b>{" "}
                  en cours
                </span>
                <span>
                  <b className="font-mono tabular-nums text-foreground">{abonnes}</b>{" "}
                  abonné(s)
                </span>
              </>
            }
          />
        </Card>
      </PageColumns>
    </PageStack>
  );
}
