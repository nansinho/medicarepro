import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
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
   Registre des mandats SEPA. Un mandat Core devient CADUC 36 mois
   après sa dernière présentation (collectée ou rejetée), ou après
   sa signature s'il n'a jamais été présenté. On signale « caduc
   bientôt » à partir de 33 mois pour représenter avant l'échéance.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mandats SEPA" };

type MandateRow = {
  id: string;
  rum: string;
  status: string;
  scheme: string;
  iban_last4: string;
  signed_at: string | null;
  last_presented_at: string | null;
  legal_hold: boolean;
  created_at: string;
  subscription: { cabinet_name: string } | null;
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "blue" | "amber" | "green" | "gray" | "red" }
> = {
  draft: { label: "Brouillon", variant: "gray" },
  sent: { label: "Envoyé", variant: "blue" },
  signed: { label: "Signé", variant: "green" },
  active: { label: "Actif", variant: "green" },
  revoked: { label: "Révoqué", variant: "red" },
  lapsed: { label: "Caduc", variant: "gray" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

function fmtDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  out.setMonth(out.getMonth() + months);
  return out;
}

/** Échéance de caducité (36 mois après la dernière présentation, ou la
    signature à défaut), null si le mandat n'est pas encore prélevable. */
function lapseInfo(mandate: MandateRow): {
  lapseAt: Date;
  soon: boolean;
  overdue: boolean;
} | null {
  if (mandate.status !== "signed" && mandate.status !== "active") return null;
  const reference = mandate.last_presented_at ?? mandate.signed_at;
  if (!reference) return null;
  const refDate = new Date(reference);
  const now = new Date();
  return {
    lapseAt: addMonths(refDate, 36),
    soon: now >= addMonths(refDate, 33),
    overdue: now >= addMonths(refDate, 36),
  };
}

export default async function MandatsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Mandats SEPA" />
        <Notice tone="warn" title="Supabase non configuré">
          Le registre des mandats est indisponible.
        </Notice>
      </div>
    );
  }

  /* Hint FK obligatoire : deux relations existent entre sepa_mandates et
     subscriptions (subscription_id ↔ sepa_mandate_id) — sans lui,
     l'embedding serait ambigu. */
  const { data, error } = await service
    .from("sepa_mandates")
    .select(
      "id, rum, status, scheme, iban_last4, signed_at, last_presented_at, legal_hold, created_at, subscription:subscriptions!sepa_mandates_subscription_id_fkey(cabinet_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as MandateRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Mandats SEPA"
        description="Registre des mandats de prélèvement (Core). Un mandat sans présentation pendant 36 mois devient caduc (signalé ici dès 33 mois pour représenter à temps)."
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucun mandat pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">RUM</TableHead>
                  <TableHead className="min-w-[180px]">Cabinet</TableHead>
                  <TableHead className="w-36">Statut</TableHead>
                  <TableHead className="w-28">IBAN</TableHead>
                  <TableHead className="w-32 text-right">Signé le</TableHead>
                  <TableHead className="w-40 text-right">
                    Dernière présentation
                  </TableHead>
                  <TableHead className="min-w-[200px] text-right">
                    Caducité
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((mandate) => {
                  const badge = STATUS_BADGE[mandate.status] ?? {
                    label: mandate.status,
                    variant: "gray" as const,
                  };
                  const lapse = lapseInfo(mandate);
                  return (
                    <TableRow key={mandate.id}>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {mandate.rum}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {mandate.subscription?.cabinet_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {mandate.legal_hold && (
                            <Badge variant="red">Litige</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        •••• {mandate.iban_last4}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtDate(mandate.signed_at)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtDate(mandate.last_presented_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lapse ? (
                          lapse.overdue ? (
                            <span className="font-medium text-bad">
                              Caduc depuis le {dateFmt.format(lapse.lapseAt)}
                            </span>
                          ) : lapse.soon ? (
                            <span className="font-medium text-warn">
                              Caduc bientôt, le {dateFmt.format(lapse.lapseAt)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              le {dateFmt.format(lapse.lapseAt)}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
