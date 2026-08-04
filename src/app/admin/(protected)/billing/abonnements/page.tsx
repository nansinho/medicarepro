import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
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
   Abonnements — registre de facturation (table subscriptions).
   Liste triée par création décroissante, 200 lignes max (v1).
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

const STATUS: Record<string, { label: string; variant: "green" | "amber" | "red" | "gray" | "blue" }> = {
  active: { label: "Actif", variant: "green" },
  pending_mandate: { label: "Mandat à signer", variant: "amber" },
  past_due: { label: "Impayé", variant: "amber" },
  suspended: { label: "Suspendu", variant: "red" },
  canceled: { label: "Résilié", variant: "gray" },
  expired: { label: "Expiré", variant: "gray" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const fmtDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "—");

export default async function AbonnementsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Abonnements" />
        <Notice tone="warn" title="Supabase non configuré">
          La liste des abonnements est indisponible.
        </Notice>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Abonnements"
        description={`Registre de facturation (${rows.length} affiché(s), 200 max). Le montant indiqué est celui du prochain renouvellement SEPA.`}
      />

      {error && <Notice tone="bad" title="Erreur de lecture">{error.message}</Notice>}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucun abonnement pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Cabinet</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="w-24 text-right">Collab.</TableHead>
                  <TableHead className="w-32">Statut</TableHead>
                  <TableHead className="w-40 text-right">Fin de période</TableHead>
                  <TableHead className="w-40 text-right">Renouvellement</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((sub) => {
                  const st = STATUS[sub.status] ?? { label: sub.status, variant: "gray" as const };
                  const href = `/admin/billing/abonnements/${sub.id}`;
                  return (
                    <TableRow key={sub.id} className="group">
                      <TableCell>
                        <Link href={href} className="flex items-center gap-3">
                          <span className="grid size-8 flex-none place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15">
                            {sub.cabinet_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground group-hover:text-primary">
                              {sub.cabinet_name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{sub.admin_email}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{PLAN_LABEL[sub.plan] ?? sub.plan}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {sub.extra_collaborators}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtDate(sub.current_period_end)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                        {formatEuros(sub.renewal_amount_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={href}>
                          <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
            <span>{rows.length} abonnement(s) affiché(s), 200 max.</span>
            <span>Trié par création, du plus récent au plus ancien.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
