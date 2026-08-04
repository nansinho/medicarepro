import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { PageHeading, StatBand, Notice, type Stat } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================================================
   Tableau de bord facturation — cockpit : indicateurs, derniers
   abonnements, échéances proches, incidents. Service client :
   le layout a déjà validé le rôle admin.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tableau de bord" };

const INCIDENT_FILTER =
  "status.in.(failed_conflict,amount_mismatch,duplicate_paid),and(status.eq.paid,provision_attempts.gt.8)";

const PLAN_LABEL: Record<string, string> = { MONTHLY: "Mensuel", ANNUAL: "Annuel" };
const SUB_STATUS: Record<string, { label: string; variant: "green" | "amber" | "red" | "gray" }> = {
  active: { label: "Actif", variant: "green" },
  pending_mandate: { label: "Mandat à signer", variant: "amber" },
  past_due: { label: "Impayé", variant: "amber" },
  suspended: { label: "Suspendu", variant: "red" },
  canceled: { label: "Résilié", variant: "gray" },
  expired: { label: "Expiré", variant: "gray" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const nf = new Intl.NumberFormat("fr-FR");

type SubRow = {
  id: string;
  cabinet_name: string;
  admin_email: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  renewal_amount_cents: number;
};

export default async function AdminDashboardPage() {
  const staff = await requireStaff();
  if (!(await getIsAdmin(staff))) redirect("/admin/contenu");

  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Tableau de bord" />
        <Notice tone="warn" title="Supabase non configuré">
          Les données de facturation sont indisponibles sur cet environnement.
        </Notice>
      </div>
    );
  }

  /* Server Component dynamique (force-dynamic) : l'heure de la requête est
     voulue ici, la règle de pureté ne s'applique pas au rendu serveur. */
  // eslint-disable-next-line react-hooks/purity
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const [actifs, echeances, incidents, syncTasks, recentRes, upcomingRes] = await Promise.all([
    service.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    service
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lt("current_period_end", in30Days),
    service.from("pending_signups").select("id", { count: "exact", head: true }).or(INCIDENT_FILTER),
    service.from("app_sync_tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service
      .from("subscriptions")
      .select("id, cabinet_name, admin_email, plan, status, current_period_end, renewal_amount_cents")
      .order("created_at", { ascending: false })
      .limit(6),
    service
      .from("subscriptions")
      .select("id, cabinet_name, admin_email, plan, status, current_period_end, renewal_amount_cents")
      .eq("status", "active")
      .lt("current_period_end", in30Days)
      .order("current_period_end", { ascending: true })
      .limit(6),
  ]);

  const nActifs = actifs.count ?? 0;
  const nEch = echeances.count ?? 0;
  const nIncidents = incidents.count ?? 0;
  const nSync = syncTasks.count ?? 0;
  const recent = (recentRes.data ?? []) as SubRow[];
  const upcoming = (upcomingRes.data ?? []) as SubRow[];

  const stats: Stat[] = [
    { label: "Abonnements actifs", value: nf.format(nActifs), hint: "À jour de paiement", zero: nActifs === 0 },
    { label: "Échéances < 30 jours", value: nf.format(nEch), hint: "Renouvellements SEPA", zero: nEch === 0 },
    { label: "Incidents ouverts", value: nf.format(nIncidents), hint: "Conflits, écarts, échecs", zero: nIncidents === 0 },
    { label: "Synchro en attente", value: nf.format(nSync), hint: "À reporter dans l'app", zero: nSync === 0 },
  ];

  function subRow(sub: SubRow, showRenewal: boolean) {
    const st = SUB_STATUS[sub.status] ?? { label: sub.status, variant: "gray" as const };
    return (
      <Link
        key={sub.id}
        href={`/admin/billing/abonnements/${sub.id}`}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50"
      >
        <span className="grid size-8 flex-none place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15">
          {sub.cabinet_name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{sub.cabinet_name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {PLAN_LABEL[sub.plan] ?? sub.plan} · {sub.admin_email}
          </span>
        </span>
        {showRenewal ? (
          <span className="flex-none text-right">
            <span className="block font-mono text-[13px] font-medium tabular-nums text-foreground">
              {formatEuros(sub.renewal_amount_cents)}
            </span>
            <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
              {sub.current_period_end ? dateFmt.format(new Date(sub.current_period_end)) : "—"}
            </span>
          </span>
        ) : (
          <Badge variant={st.variant}>{st.label}</Badge>
        )}
        <ChevronRight className="size-4 flex-none text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Tableau de bord"
        description="Vue d'ensemble de la facturation : abonnements, échéances, incidents de provisioning et synchronisation avec l'application."
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/billing/abonnements">
              <BadgeCheck />
              Tous les abonnements
            </Link>
          </Button>
        }
      />

      <StatBand stats={stats} />

      {(nIncidents > 0 || nSync > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {nIncidents > 0 && (
            <Notice
              tone="bad"
              title={`${nf.format(nIncidents)} incident(s) de provisioning`}
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/billing/incidents">Traiter</Link>
                </Button>
              }
            >
              Conflits, écarts de montant, doubles paiements ou échecs répétés à résoudre.
            </Notice>
          )}
          {nSync > 0 && (
            <Notice
              tone="warn"
              title={`${nf.format(nSync)} tâche(s) de synchro en attente`}
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/billing/synchro">Ouvrir</Link>
                </Button>
              }
            >
              À reporter manuellement dans l&apos;application des cabinets.
            </Notice>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <RefreshCw className="size-4 text-muted-foreground" />
              Derniers abonnements
            </CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/billing/abonnements">
                Tout voir
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          {recent.length > 0 ? (
            <div className="divide-y divide-border">{recent.map((s) => subRow(s, false))}</div>
          ) : (
            <CardContent>
              <p className="text-[13px] text-muted-foreground">Aucun abonnement enregistré.</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <CalendarClock className="size-4 text-muted-foreground" />
              Échéances à venir (30 jours)
            </CardTitle>
            {nEch > 0 && <Badge variant="amber">{nf.format(nEch)}</Badge>}
          </CardHeader>
          {upcoming.length > 0 ? (
            <div className="divide-y divide-border">{upcoming.map((s) => subRow(s, true))}</div>
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
                <CalendarClock className="size-4" />
              </span>
              <p className="mt-1 text-[13px] font-medium text-foreground">Aucune échéance sous 30 jours</p>
              <p className="text-xs text-muted-foreground">Les renouvellements SEPA proches s&apos;afficheront ici.</p>
            </div>
          )}
        </Card>
      </div>

      {nIncidents === 0 && nSync === 0 && (
        <Notice tone="ok" title="Facturation saine">
          Aucun incident de provisioning, aucune tâche de synchronisation en attente.
        </Notice>
      )}
    </div>
  );
}
