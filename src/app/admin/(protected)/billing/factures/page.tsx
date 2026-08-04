import type { Metadata } from "next";
import Link from "next/link";
import { Download, ReceiptEuro } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { Notice, StatBand } from "@/components/admin/shared";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { EmptyState, NotConfigured } from "@/components/admin/kit/states";
import DataTable, { RowActions } from "@/components/admin/kit/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ============================================================
   Factures émises (pièces comptables, PDF dans le bucket privé
   'billing'). « Télécharger » passe par la route /download qui
   re-vérifie le rôle admin puis redirige vers une URL signée
   courte (60 s). Pas de FK invoices→subscriptions : le nom du
   cabinet est résolu par un second lookup.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Factures" };

type InvoiceRow = {
  id: string;
  number: string;
  subscription_id: string | null;
  kind: string;
  amount_cents: number;
  currency: string;
  issued_at: string;
};

const KIND_BADGE: Record<
  string,
  { label: string; variant: "blue" | "green" | "amber" | "gray" }
> = {
  card_first: { label: "1er paiement carte", variant: "blue" },
  sdd_renewal: { label: "Renouvellement SEPA", variant: "green" },
  credit_note: { label: "Avoir", variant: "amber" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

export default async function FacturesPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Factures" />
        <NotConfigured scope="La liste des factures" />
      </PageStack>
    );
  }

  const { data, error } = await service
    .from("invoices")
    .select("id, number, subscription_id, kind, amount_cents, currency, issued_at")
    .order("issued_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as InvoiceRow[];

  /* Noms de cabinet des abonnements liés (pas de FK → pas d'embedding). */
  const subscriptionIds = [
    ...new Set(
      rows
        .map((invoice) => invoice.subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cabinetById = new Map<string, string>();
  if (subscriptionIds.length > 0) {
    const { data: subs } = await service
      .from("subscriptions")
      .select("id, cabinet_name")
      .in("id", subscriptionIds);
    for (const sub of (subs ?? []) as { id: string; cabinet_name: string }[]) {
      cabinetById.set(sub.id, sub.cabinet_name);
    }
  }

  /* Synthèses sur les lignes affichées : rien de plus n'est requêté. */
  const total = rows
    .filter((r) => r.kind !== "credit_note")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const avoirs = rows.filter((r) => r.kind === "credit_note").length;
  const periode =
    rows.length > 0
      ? `${dateFmt.format(new Date(rows[rows.length - 1].issued_at))} → ${dateFmt.format(new Date(rows[0].issued_at))}`
      : undefined;

  return (
    <PageStack>
      <PageHeader
        title="Factures"
        description="Pièces comptables émises. Le téléchargement passe par une URL signée à durée courte : le PDF n'est jamais public."
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      {rows.length > 0 && (
        <StatBand
          stats={[
            { label: "Factures affichées", value: rows.length, hint: "200 max" },
            { label: "Total facturé", value: formatEuros(total), hint: "Hors avoirs" },
            { label: "Avoirs", value: avoirs, zero: avoirs === 0 },
            { label: "Période couverte", value: periode ?? "—" },
          ]}
        />
      )}

      <Card className="overflow-clip">
        <DataTable
          rows={rows}
          getKey={(invoice) => invoice.id}
          columns={[
            {
              id: "number",
              header: "Numéro",
              role: "mono",
              cell: (invoice) => invoice.number,
            },
            {
              id: "subscription",
              header: "Abonnement",
              role: "grow",
              truncate: true,
              title: (invoice) =>
                invoice.subscription_id
                  ? cabinetById.get(invoice.subscription_id)
                  : undefined,
              cell: (invoice) => {
                const cabinet = invoice.subscription_id
                  ? cabinetById.get(invoice.subscription_id)
                  : undefined;
                return invoice.subscription_id && cabinet ? (
                  <Link
                    href={`/admin/billing/abonnements/${invoice.subscription_id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {cabinet}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{cabinet ?? "—"}</span>
                );
              },
            },
            {
              id: "kind",
              header: "Type",
              cell: (invoice) => {
                const badge = KIND_BADGE[invoice.kind] ?? {
                  label: invoice.kind,
                  variant: "gray" as const,
                };
                return <Badge variant={badge.variant}>{badge.label}</Badge>;
              },
            },
            {
              id: "amount",
              header: "Montant",
              role: "money",
              cell: (invoice) => formatEuros(invoice.amount_cents),
            },
            {
              id: "issued",
              header: "Émise le",
              role: "date",
              cell: (invoice) => dateFmt.format(new Date(invoice.issued_at)),
            },
            {
              id: "download",
              header: "",
              role: "actions",
              cell: (invoice) => (
                <RowActions>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/admin/billing/factures/${invoice.id}/download`}>
                      <Download />
                      Télécharger
                    </a>
                  </Button>
                </RowActions>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={ReceiptEuro}
              title="Aucune facture émise"
              description="Une facture est produite automatiquement à chaque paiement encaissé."
            />
          }
          footer={
            <>
              <span>{rows.length} facture(s) affichée(s), 200 max.</span>
              <span className="ml-auto">
                Triées par date d&apos;émission, de la plus récente à la plus
                ancienne.
              </span>
            </>
          }
        />
      </Card>
    </PageStack>
  );
}
