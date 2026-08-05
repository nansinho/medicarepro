import type { Metadata } from "next";
import { CreditCard, Link2 } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { PageHeader, PageStack, PageColumns } from "@/components/admin/kit/layout";
import { EmptyState, NotConfigured } from "@/components/admin/kit/states";
import DataTable, { CellTitle } from "@/components/admin/kit/DataTable";
import SubscribeLinkForm from "@/components/admin/billing/SubscribeLinkForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================================================
   Souscriptions de cabinets existants.

   Sert le cas des cabinets qui utilisent déjà le logiciel sans payer : on
   leur ouvre un accès à l'espace abonnement, où ils choisissent leur formule
   et règlent. Aucun compte n'est créé, aucune donnée n'est touchée.

   Cet écran disparaîtra en grande partie le jour où l'application affichera
   son bouton « Gérer mon abonnement » : il restera le suivi.

   MISE EN PAGE : deux colonnes dès que la place existe. À gauche l'action et
   ce qu'elle produit, à droite un rail de contexte. Les liens d'accès récents
   y ont été déplacés : quatre colonnes étalées sur 1600px laissaient un vide
   énorme, alors qu'en rail elles remplissent le quadrant qui restait blanc.
   Toutes les synthèses sont calculées sur les lignes DÉJÀ chargées : aucune
   requête supplémentaire, aucune valeur inventée.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Souscriptions" };

type OrderRow = {
  id: string;
  kind: string;
  plan: string;
  status: string;
  amount_cents: number;
  currency: string;
  monetico_reference: string;
  app_cabinet_id: string;
  billing_snapshot: { cabinetName?: string } | null;
  created_at: string;
};

type LinkRow = {
  id: string;
  app_cabinet_id: string;
  cabinet: { name?: string } | null;
  created_via: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  initial: "Inscription",
  attach: "Souscription",
  resubscribe: "Reprise",
  card_update: "Changement de carte",
  plan_change: "Changement de formule",
};

const ORDER_STATUS: Record<
  string,
  { label: string; variant: "green" | "amber" | "red" | "gray" | "blue" }
> = {
  pending: { label: "En attente de paiement", variant: "blue" },
  paid: { label: "Payée", variant: "amber" },
  applied: { label: "Appliquée", variant: "green" },
  amount_mismatch: { label: "Montant inattendu", variant: "red" },
  expired: { label: "Abandonnée", variant: "gray" },
  failed: { label: "Refusée", variant: "red" },
};

const dtFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const fmt = (v: string | null) => (v ? dtFmt.format(new Date(v)) : "—");

export default async function SouscriptionsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Souscriptions" />
        <NotConfigured scope="L'émission de liens de souscription" />
      </PageStack>
    );
  }

  const [{ data: orders }, { data: links }] = await Promise.all([
    service
      .from("subscription_orders")
      .select(
        "id, kind, plan, status, amount_cents, currency, monetico_reference, app_cabinet_id, billing_snapshot, created_at",
      )
      .neq("kind", "initial")
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("portal_links")
      .select(
        "id, app_cabinet_id, cabinet, created_via, expires_at, consumed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orderRows = (orders ?? []) as OrderRow[];
  const linkRows = (links ?? []) as LinkRow[];

  /* Page dynamique : l'heure de la requête est exactement ce qu'on veut ici. */
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const oApplied = orderRows.filter((o) => o.status === "applied").length;
  const oPending = orderRows.filter((o) => o.status === "pending").length;
  const oStuck = orderRows.filter(
    (o) =>
      o.status === "paid" ||
      o.status === "amount_mismatch" ||
      o.status === "failed",
  ).length;
  const oEncaisse = orderRows
    .filter((o) => o.status === "applied")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const lUsed = linkRows.filter((l) => l.consumed_at).length;
  const lExpired = linkRows.filter(
    (l) => !l.consumed_at && new Date(l.expires_at).getTime() < now,
  ).length;
  const lWaiting = linkRows.length - lUsed - lExpired;

  return (
    <PageStack>
      <PageHeader
        title="Souscriptions"
        description="Ouvrir l'espace abonnement à un cabinet qui utilise déjà le logiciel. Il y choisit sa formule et règle : aucun compte n'est créé, ses dossiers ne sont pas touchés."
      />

      <PageColumns
        aside={
          <>
            <Card className="overflow-clip">
              <CardHeader>
                <CardTitle>Liens d&apos;accès récents</CardTitle>
                {linkRows.length > 0 && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {linkRows.length}
                  </span>
                )}
              </CardHeader>

              {linkRows.length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="Aucun lien émis"
                  description="Le premier lien créé ci-contre apparaîtra ici."
                />
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {linkRows.map((l) => {
                      const used = Boolean(l.consumed_at);
                      const expired =
                        !used && new Date(l.expires_at).getTime() < now;
                      return (
                        <div
                          key={l.id}
                          className="flex items-start gap-2.5 px-5 py-2.5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-cell font-medium text-foreground">
                              {l.cabinet?.name ?? l.app_cabinet_id}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {l.created_via === "admin"
                                ? "Back-office"
                                : "Application"}{" "}
                              · {fmt(l.created_at)}
                            </span>
                          </span>
                          <Badge
                            variant={used ? "green" : expired ? "gray" : "blue"}
                            className="mt-0.5 flex-none"
                          >
                            {used ? "Ouvert" : expired ? "Expiré" : "En attente"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <CardFooter className="justify-between">
                    <span>
                      <b className="font-mono tabular-nums text-foreground">
                        {lUsed}
                      </b>{" "}
                      ouvert(s)
                    </span>
                    <span>
                      <b className="font-mono tabular-nums text-foreground">
                        {lWaiting}
                      </b>{" "}
                      en attente
                    </span>
                    <span>
                      <b className="font-mono tabular-nums text-foreground">
                        {lExpired}
                      </b>{" "}
                      expiré(s)
                    </span>
                  </CardFooter>
                </>
              )}
            </Card>

            {/* Les trois règles du lien : elles étaient noyées en 12px sous le
                bouton d'envoi, donc lues après coup. Elles se lisent avant. */}
            <Card>
              <CardHeader>
                <CardTitle>Ce que fait ce lien</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2.5 p-5 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <b className="text-foreground">Usage unique, 15 minutes.</b>{" "}
                  Il n&apos;est jamais envoyé par email : il serait périmé à
                  l&apos;ouverture. Transmettez-le par téléphone ou message.
                </p>
                <p>
                  <b className="text-foreground">Aucun compte créé.</b>{" "}
                  Le cabinet existe déjà dans l&apos;application ; ses dossiers ne sont pas
                  touchés.
                </p>
                <p>
                  <b className="text-foreground">Affiché une seule fois.</b>{" "}
                  Il n&apos;est pas conservé et ne réapparaîtra pas après avoir
                  quitté la page.
                </p>
              </div>
            </Card>
          </>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Nouveau lien de souscription</CardTitle>
          </CardHeader>
          <SubscribeLinkForm />
        </Card>

        <Card className="overflow-clip">
          <CardHeader>
            <CardTitle>Commandes hors tunnel</CardTitle>
            {orderRows.length > 0 && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {orderRows.length}
              </span>
            )}
          </CardHeader>

          <DataTable
            rows={orderRows}
            getKey={(o) => o.id}
            columns={[
              {
                id: "cabinet",
                header: "Cabinet",
                role: "grow",
                truncate: true,
                title: (o) => o.billing_snapshot?.cabinetName ?? o.app_cabinet_id,
                cell: (o) => (
                  <CellTitle sub={KIND_LABEL[o.kind] ?? o.kind}>
                    {o.billing_snapshot?.cabinetName ?? o.app_cabinet_id}
                  </CellTitle>
                ),
              },
              {
                id: "plan",
                header: "Formule",
                cell: (o) => (o.plan === "MONTHLY" ? "Mensuel" : "Annuel"),
              },
              {
                id: "amount",
                header: "Montant",
                role: "money",
                cell: (o) => formatEuros(o.amount_cents),
              },
              {
                id: "ref",
                header: "Référence",
                role: "mono",
                cell: (o) => o.monetico_reference,
              },
              {
                id: "status",
                header: "État",
                cell: (o) => {
                  const st = ORDER_STATUS[o.status] ?? {
                    label: o.status,
                    variant: "gray" as const,
                  };
                  return <Badge variant={st.variant}>{st.label}</Badge>;
                },
              },
              {
                id: "created",
                header: "Ouverte le",
                role: "date",
                cell: (o) => fmt(o.created_at),
              },
            ]}
            empty={
              <EmptyState
                icon={CreditCard}
                title="Aucune commande hors tunnel"
                description="Elles apparaîtront ici dès qu'un cabinet aura ouvert un paiement depuis son espace abonnement."
              />
            }
            footer={
              <>
                <span>
                  <b className="font-mono tabular-nums text-foreground">
                    {oApplied}
                  </b>{" "}
                  appliquée(s)
                </span>
                <span>
                  <b className="font-mono tabular-nums text-foreground">
                    {oPending}
                  </b>{" "}
                  en attente de paiement
                </span>
                {oStuck > 0 && (
                  <span className="text-[color:var(--warn)]">
                    <b className="font-mono tabular-nums">{oStuck}</b>{" "}
                    à traiter
                  </span>
                )}
                <span className="ml-auto">
                  Encaissé sur ces {orderRows.length} commandes :{" "}
                  <b className="font-mono tabular-nums text-foreground">
                    {formatEuros(oEncaisse)}
                  </b>
                </span>
              </>
            }
          />
        </Card>
      </PageColumns>
    </PageStack>
  );
}
