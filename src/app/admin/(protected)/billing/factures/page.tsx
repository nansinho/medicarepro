import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <div className="flex flex-col gap-4">
        <PageHeading title="Factures" />
        <Notice tone="warn" title="Supabase non configuré">
          La liste des factures est indisponible.
        </Notice>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Factures"
        description={`Factures émises (${rows.length} affichées, 200 max). Le téléchargement passe par une URL signée à durée courte (le PDF n'est jamais public).`}
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucune facture émise pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Numéro</TableHead>
                  <TableHead className="min-w-[200px]">Abonnement</TableHead>
                  <TableHead className="min-w-[160px]">Type</TableHead>
                  <TableHead className="w-28 text-right">Montant</TableHead>
                  <TableHead className="w-32 text-right">Émise le</TableHead>
                  <TableHead className="w-36 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((invoice) => {
                  const badge = KIND_BADGE[invoice.kind] ?? {
                    label: invoice.kind,
                    variant: "gray" as const,
                  };
                  const cabinet = invoice.subscription_id
                    ? cabinetById.get(invoice.subscription_id)
                    : undefined;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs tabular-nums text-foreground">
                        {invoice.number}
                      </TableCell>
                      <TableCell>
                        {invoice.subscription_id && cabinet ? (
                          <Link
                            href={`/admin/billing/abonnements/${invoice.subscription_id}`}
                            className="hover:text-primary"
                          >
                            {cabinet}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {cabinet ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                        {formatEuros(invoice.amount_cents)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {dateFmt.format(new Date(invoice.issued_at))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`/admin/billing/factures/${invoice.id}/download`}
                          >
                            <Download />
                            Télécharger
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
