import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { Notice, StatBand } from "@/components/admin/shared";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { EmptyState, NotConfigured } from "@/components/admin/kit/states";
import DataTable, { CellTitle } from "@/components/admin/kit/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/* ============================================================
   Abonnements — registre de facturation (table subscriptions).
   Liste triée par création décroissante, 200 lignes max (v1).

   Le bandeau de mesures en tête est calculé sur les lignes DÉJÀ
   chargées : aucune requête de plus, aucune valeur inventée. C'est la
   réponse honnête au « remplir un écran large » — agréger ce qu'on a
   déjà, plutôt qu'étirer un tableau de sept colonnes sur 1700px.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Abonnements" };

type SubscriptionRow = {
  id: string;
  cabinet_name: string;
  admin_email: string;
  plan: "MONTHLY" | "ANNUAL";
  extra_collaborators: number;
  status: string;
  current_period_end: string;
  renewal_amount_cents: number;
  currency: string;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = { MONTHLY: "Mensuel", ANNUAL: "Annuel" };

const STATUS: Record<
  string,
  { label: string; variant: "green" | "amber" | "red" | "gray" | "blue" }
> = {
  active: { label: "Actif", variant: "green" },
  pending_mandate: { label: "Mandat à signer", variant: "amber" },
  past_due: { label: "Impayé", variant: "amber" },
  suspended: { label: "Suspendu", variant: "red" },
  canceled: { label: "Résilié", variant: "gray" },
  expired: { label: "Expiré", variant: "gray" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});
const fmtDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "—");

export default async function AbonnementsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Abonnements" />
        <NotConfigured scope="Le registre des abonnements" />
      </PageStack>
    );
  }

  const { data, error } = await service
    .from("subscriptions")
    .select(
      "id, cabinet_name, admin_email, plan, extra_collaborators, status, current_period_end, renewal_amount_cents, currency, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as SubscriptionRow[];

  /* Synthèses sur les lignes affichées. */
  const active = rows.filter((r) => r.status === "active").length;
  const attention = rows.filter(
    (r) => r.status === "past_due" || r.status === "pending_mandate",
  ).length;
  const mrr = rows
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + r.renewal_amount_cents, 0);
  const nextEnd = rows
    .filter((r) => r.status === "active" && r.current_period_end)
    .map((r) => r.current_period_end)
    .sort()[0];

  return (
    <PageStack>
      <PageHeader
        title="Abonnements"
        description="Registre de facturation. Le montant indiqué est celui du prochain renouvellement SEPA."
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      {rows.length > 0 && (
        <StatBand
          stats={[
            { label: "Abonnements affichés", value: rows.length },
            { label: "Actifs", value: active, zero: active === 0 },
            {
              label: "À surveiller",
              value: attention,
              zero: attention === 0,
              hint: "Impayés et mandats à signer",
            },
            {
              label: "Renouvellements à venir",
              value: formatEuros(mrr),
              hint: nextEnd ? `Prochaine échéance le ${fmtDate(nextEnd)}` : undefined,
            },
          ]}
        />
      )}

      <Card className="overflow-clip">
        <DataTable
          rows={rows}
          getKey={(sub) => sub.id}
          href={(sub) => `/admin/billing/abonnements/${sub.id}`}
          columns={[
            {
              id: "cabinet",
              header: "Cabinet",
              role: "grow",
              truncate: true,
              title: (sub) => sub.cabinet_name,
              cell: (sub) => (
                <span className="flex items-center gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-md bg-[color:var(--mp-tone-primary-bg)] text-xs font-semibold text-[color:var(--mp-blue-mid)]">
                    {sub.cabinet_name.slice(0, 2).toUpperCase()}
                  </span>
                  <CellTitle sub={sub.admin_email}>{sub.cabinet_name}</CellTitle>
                </span>
              ),
            },
            {
              id: "plan",
              header: "Plan",
              cell: (sub) => (
                <span className="text-muted-foreground">
                  {PLAN_LABEL[sub.plan] ?? sub.plan}
                </span>
              ),
            },
            {
              id: "collab",
              header: "Collab.",
              role: "num",
              cell: (sub) => sub.extra_collaborators,
            },
            {
              id: "status",
              header: "Statut",
              cell: (sub) => {
                const st = STATUS[sub.status] ?? {
                  label: sub.status,
                  variant: "gray" as const,
                };
                return <Badge variant={st.variant}>{st.label}</Badge>;
              },
            },
            {
              id: "period",
              header: "Fin de période",
              role: "date",
              cell: (sub) => fmtDate(sub.current_period_end),
            },
            {
              id: "renewal",
              header: "Renouvellement",
              role: "money",
              cell: (sub) => formatEuros(sub.renewal_amount_cents),
            },
          ]}
          empty={
            <EmptyState
              icon={BadgeCheck}
              title="Aucun abonnement pour le moment"
              description="Les abonnements apparaissent ici dès qu'une souscription est réglée."
            />
          }
          footer={
            <>
              <span>{rows.length} abonnement(s) affiché(s), 200 max.</span>
              <span className="ml-auto">
                Trié par création, du plus récent au plus ancien.
              </span>
            </>
          }
        />
      </Card>
    </PageStack>
  );
}
