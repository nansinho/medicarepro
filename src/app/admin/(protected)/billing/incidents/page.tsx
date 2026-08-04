import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { Notice, StatBand } from "@/components/admin/shared";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { EmptyState, NotConfigured } from "@/components/admin/kit/states";
import DataTable, { CellTitle, RowActions } from "@/components/admin/kit/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relancerProvisioning, marquerResolu } from "./actions";

/* ============================================================
   Incidents billing — dossiers pending_signups en échec :
   - failed_conflict  : 409 dev B après paiement (manuel)
   - amount_mismatch  : montant IPN ≠ attendu (manuel)
   - duplicate_paid   : double paiement d'une chaîne (remboursement)
   - paid, > 8 tentatives : provisioning en échec répété.
   Actions : relancer le provisioning (le worker garde l'exclusivité
   du POST) ou marquer résolu (abandonné/remboursé).
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Incidents" };

type IncidentRow = {
  id: string;
  status: string;
  plan: "MONTHLY" | "ANNUAL";
  amount_cents: number;
  currency: string;
  provision_attempts: number;
  last_error: string | null;
  paid_at: string | null;
  created_at: string;
  cabinet_name: string | null;
};

const STATUS_BADGE: Record<string, { label: string; variant: "red" | "amber" | "green" | "blue" | "gray" }> = {
  failed_conflict: { label: "Conflit provisioning", variant: "red" },
  amount_mismatch: { label: "Montant inattendu", variant: "red" },
  duplicate_paid: { label: "Double paiement", variant: "amber" },
  paid: { label: "Échecs répétés", variant: "amber" },
};

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Mensuel",
  ANNUAL: "Annuel",
};

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function fmtDateTime(value: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

export default async function IncidentsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Incidents" />
        <NotConfigured scope="La liste des incidents" />
      </PageStack>
    );
  }

  const { data, error } = await service
    .from("pending_signups")
    .select(
      "id, status, plan, amount_cents, currency, provision_attempts, last_error, paid_at, created_at, cabinet_name:cabinet->>name",
    )
    .or(
      "status.in.(failed_conflict,amount_mismatch,duplicate_paid),and(status.eq.paid,provision_attempts.gt.8)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as IncidentRow[];

  const enjeu = rows.reduce((sum, r) => sum + r.amount_cents, 0);
  const aRelancer = rows.filter((r) => r.status === "paid").length;
  const maxTentatives = rows.reduce(
    (max, r) => Math.max(max, r.provision_attempts),
    0,
  );

  return (
    <PageStack>
      <PageHeader
        title="Incidents"
        description="Dossiers payés en échec : conflits de provisioning, écarts de montant, doubles paiements et provisionings en échec répété. « Relancer » redonne le dossier au worker ; « Marquer résolu » clôt le dossier (abandonné ou remboursé manuellement)."
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      {rows.length > 0 && (
        <StatBand
          stats={[
            { label: "Incidents ouverts", value: rows.length },
            {
              label: "À relancer",
              value: aRelancer,
              zero: aRelancer === 0,
              hint: "Payés, provisioning en échec",
            },
            { label: "Montant en jeu", value: formatEuros(enjeu) },
            {
              label: "Tentatives max",
              value: maxTentatives,
              zero: maxTentatives === 0,
            },
          ]}
        />
      )}

      <Card className="overflow-clip">
        <DataTable
          rows={rows}
          getKey={(incident) => incident.id}
          columns={[
            {
              id: "cabinet",
              header: "Cabinet",
              role: "grow-2",
              truncate: true,
              title: (incident) => incident.cabinet_name ?? undefined,
              cell: (incident) => (
                <CellTitle
                  sub={`${PLAN_LABEL[incident.plan] ?? incident.plan} · créé le ${fmtDateTime(incident.created_at)}`}
                >
                  {incident.cabinet_name ?? "—"}
                </CellTitle>
              ),
            },
            {
              id: "status",
              header: "Statut",
              cell: (incident) => {
                const badge = STATUS_BADGE[incident.status] ?? {
                  label: incident.status,
                  variant: "gray" as const,
                };
                return <Badge variant={badge.variant}>{badge.label}</Badge>;
              },
            },
            {
              id: "amount",
              header: "Montant",
              role: "money",
              cell: (incident) => formatEuros(incident.amount_cents),
            },
            {
              id: "attempts",
              header: "Tentatives",
              role: "num",
              cell: (incident) => incident.provision_attempts,
            },
            {
              id: "error",
              header: "Dernière erreur",
              role: "grow-2",
              truncate: true,
              title: (incident) => incident.last_error ?? undefined,
              className: "font-mono text-xs text-muted-foreground",
              cell: (incident) => incident.last_error ?? "—",
            },
            {
              id: "paid",
              header: "Payé le",
              role: "date",
              cell: (incident) => fmtDateTime(incident.paid_at),
            },
            {
              id: "actions",
              header: "",
              role: "actions",
              cell: (incident) => (
                <RowActions>
                  {incident.status === "paid" && (
                    <form action={relancerProvisioning}>
                      <input type="hidden" name="id" value={incident.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Relancer
                      </Button>
                    </form>
                  )}
                  <form action={marquerResolu}>
                    <input type="hidden" name="id" value={incident.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      Marquer résolu
                    </Button>
                  </form>
                </RowActions>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="Aucun incident ouvert"
              description="Les dossiers payés dont le provisioning échoue apparaissent ici automatiquement."
            />
          }
        />
      </Card>
    </PageStack>
  );
}
