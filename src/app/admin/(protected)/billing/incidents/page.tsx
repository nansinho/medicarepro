import type { Metadata } from "next";
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
      <div className="flex flex-col gap-5">
        <PageHeading title="Incidents" />
        <Notice tone="warn" title="Supabase non configuré">
          La liste des incidents est indisponible.
        </Notice>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Incidents"
        description="Dossiers payés en échec : conflits de provisioning, écarts de montant, doubles paiements et provisionings en échec répété. « Relancer » redonne le dossier au worker ; « Marquer résolu » clôt le dossier (abandonné ou remboursé manuellement)."
      />

      {error && (
        <Notice tone="bad" title="Erreur de lecture">
          {error.message}
        </Notice>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucun incident ouvert.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Cabinet</TableHead>
                  <TableHead className="w-44">Statut</TableHead>
                  <TableHead className="w-28 text-right">Montant</TableHead>
                  <TableHead className="w-24 text-right">Tentatives</TableHead>
                  <TableHead className="min-w-[260px]">Dernière erreur</TableHead>
                  <TableHead className="w-40 text-right">Payé le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((incident) => {
                  const badge = STATUS_BADGE[incident.status] ?? {
                    label: incident.status,
                    variant: "gray" as const,
                  };
                  return (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {incident.cabinet_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {PLAN_LABEL[incident.plan] ?? incident.plan} · créé le{" "}
                          {fmtDateTime(incident.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                        {formatEuros(incident.amount_cents)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {incident.provision_attempts}
                      </TableCell>
                      <TableCell
                        className="max-w-[360px] truncate font-mono text-xs text-muted-foreground"
                        title={incident.last_error ?? undefined}
                      >
                        {incident.last_error ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtDateTime(incident.paid_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {incident.status === "paid" && (
                            <form action={relancerProvisioning}>
                              <input type="hidden" name="id" value={incident.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Relancer le provisioning
                              </Button>
                            </form>
                          )}
                          <form action={marquerResolu}>
                            <input type="hidden" name="id" value={incident.id} />
                            <Button type="submit" variant="destructive" size="sm">
                              Marquer résolu
                            </Button>
                          </form>
                        </div>
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
