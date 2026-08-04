import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CalendarClock,
  CircleCheck,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { PageHeading, StatBand, type Stat } from "@/components/admin/shared";
import { PageStack } from "@/components/admin/kit/layout";
import { EmptyState, NotConfigured } from "@/components/admin/kit/states";
import { WorkQueue, type QueueItem } from "@/components/admin/kit/WorkQueue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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

type IncidentRow = {
  id: string;
  status: string;
  amount_cents: number;
  provision_attempts: number;
  cabinet_name: string | null;
};

type DefautRow = {
  id: string;
  cabinet_name: string;
  status: string;
  renewal_amount_cents: number;
};

type SyncRow = {
  id: string;
  kind: string;
  subscription_id: string | null;
  /* PostgREST renvoie la relation embarquée sous forme de tableau, même
     pour un lien à cardinalité 1. */
  subscription: { cabinet_name: string }[] | null;
};

const INCIDENT_LABEL: Record<string, string> = {
  failed_conflict: "Conflit de provisioning",
  amount_mismatch: "Écart de montant",
  duplicate_paid: "Double paiement",
  paid: "Provisioning en échec répété",
};

export default async function AdminDashboardPage() {
  const staff = await requireStaff();
  if (!(await getIsAdmin(staff))) redirect("/admin/contenu");

  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeading title="Tableau de bord" />
        <NotConfigured scope="Le tableau de bord de facturation" />
      </PageStack>
    );
  }

  /* Server Component dynamique (force-dynamic) : l'heure de la requête est
     voulue ici, la règle de pureté ne s'applique pas au rendu serveur. */
  // eslint-disable-next-line react-hooks/purity
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();

  /* Les trois requêtes qui alimentent la file de travail renvoient
     désormais les LIGNES en plus du compte : même coût côté base, mais on
     peut nommer ce qu'il y a à faire au lieu d'afficher un nombre. */
  const [actifs, echeances, incidents, syncTasks, defauts, recentRes, upcomingRes] =
    await Promise.all([
      service.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      service
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lt("current_period_end", in30Days),
      service
        .from("pending_signups")
        .select("id, status, amount_cents, provision_attempts, cabinet_name:cabinet->>name", {
          count: "exact",
        })
        .or(INCIDENT_FILTER)
        .order("created_at", { ascending: false })
        .limit(6),
      service
        .from("app_sync_tasks")
        .select("id, kind, subscription_id, subscription:subscriptions(cabinet_name)", {
          count: "exact",
        })
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(6),
      service
        .from("subscriptions")
        .select("id, cabinet_name, status, renewal_amount_cents", { count: "exact" })
        .in("status", ["past_due", "pending_mandate"])
        .order("current_period_end", { ascending: true })
        .limit(6),
      service
        .from("subscriptions")
        .select("id, cabinet_name, admin_email, plan, status, current_period_end, renewal_amount_cents")
        .order("created_at", { ascending: false })
        .limit(8),
      service
        .from("subscriptions")
        .select("id, cabinet_name, admin_email, plan, status, current_period_end, renewal_amount_cents")
        .eq("status", "active")
        .lt("current_period_end", in30Days)
        .order("current_period_end", { ascending: true })
        .limit(8),
    ]);

  const nActifs = actifs.count ?? 0;
  const nEch = echeances.count ?? 0;
  const nIncidents = incidents.count ?? 0;
  const nSync = syncTasks.count ?? 0;
  const nDefauts = defauts.count ?? 0;
  const recent = (recentRes.data ?? []) as SubRow[];
  const upcoming = (upcomingRes.data ?? []) as SubRow[];

  /* File de travail : trois sources réelles fusionnées, triées par gravité. */
  const queue: QueueItem[] = [
    ...((incidents.data ?? []) as IncidentRow[]).map((i) => ({
      id: `inc-${i.id}`,
      severity: "urgent" as const,
      title: i.cabinet_name ?? "Dossier sans nom",
      detail: `${INCIDENT_LABEL[i.status] ?? i.status} · ${i.provision_attempts} tentative(s)`,
      href: "/admin/billing/incidents",
      meta: formatEuros(i.amount_cents),
    })),
    ...((defauts.data ?? []) as DefautRow[]).map((s) => ({
      id: `def-${s.id}`,
      severity: "attention" as const,
      title: s.cabinet_name,
      detail:
        s.status === "past_due"
          ? "Impayé : relance ou suspension à décider"
          : "Mandat SEPA jamais signé",
      href: `/admin/billing/abonnements/${s.id}`,
      meta: formatEuros(s.renewal_amount_cents),
    })),
    ...((syncTasks.data ?? []) as SyncRow[]).map((t) => ({
      id: `sync-${t.id}`,
      severity: "info" as const,
      title: t.subscription?.[0]?.cabinet_name ?? "Cabinet inconnu",
      detail: `À reporter dans l'application : ${t.kind}`,
      href: "/admin/billing/synchro",
    })),
  ];

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
        className="mp-row group flex items-center gap-3 px-5 py-2.5"
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
    <PageStack>
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

      <div className="grid gap-4 xl:grid-cols-2 @ultra/page:grid-cols-3">
        {/* À traiter en premier : une file de travail réelle, pas un
            bandeau de félicitations. Elle occupe la colonne de gauche
            parce que c'est par là qu'on commence sa journée. */}
        <Card className="overflow-clip">
          <CardHeader>
            <CardTitle>
              <ListChecks className="size-4 text-muted-foreground" />À traiter
            </CardTitle>
            {queue.length > 0 && (
              <Badge variant={nIncidents > 0 ? "red" : "amber"}>
                {nf.format(nIncidents + nDefauts + nSync)}
              </Badge>
            )}
          </CardHeader>
          {queue.length > 0 ? (
            <>
              <WorkQueue items={queue} />
              <CardFooter className="justify-between">
                <span>
                  {nf.format(nIncidents)} incident(s) · {nf.format(nDefauts)} en
                  défaut · {nf.format(nSync)} synchro
                </span>
                <Link
                  href="/admin/billing/incidents"
                  className="font-medium text-primary hover:underline"
                >
                  Tout traiter
                </Link>
              </CardFooter>
            </>
          ) : (
            <EmptyState
              icon={CircleCheck}
              title="Rien à traiter"
              description="Aucun incident de provisioning, aucun impayé, aucune tâche de synchronisation en attente."
            />
          )}
        </Card>

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
            <EmptyState
              icon={CalendarClock}
              title="Aucune échéance sous 30 jours"
              description="Les renouvellements SEPA proches s'afficheront ici."
            />
          )}
        </Card>
      </div>
    </PageStack>
  );
}
