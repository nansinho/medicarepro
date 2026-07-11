import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Tableau de bord billing — 4 indicateurs, cartes cliquables.
   Requêtes en count-only (head:true) via le service client :
   le layout a déjà validé le rôle admin.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tableau de bord" };

/* Filtre « incident ouvert » : statuts terminaux d'échec + dossiers payés
   dont le provisioning échoue en boucle (> 8 tentatives). */
const INCIDENT_FILTER =
  "status.in.(failed_conflict,amount_mismatch,duplicate_paid),and(status.eq.paid,provision_attempts.gt.8)";

export default async function AdminDashboardPage() {
  /* Le tableau de bord racine est celui de la facturation (admin) :
     un éditeur atterrit sur sa page d'accueil à lui, le contenu. */
  const staff = await requireStaff();
  if (!(await getIsAdmin(staff))) redirect("/admin/contenu");

  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Tableau de bord</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL /
          SUPABASE_SERVICE_ROLE_KEY) : les données de facturation sont
          indisponibles sur cet environnement.
        </p>
      </>
    );
  }

  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const [actifs, echeances, incidents, syncTasks] = await Promise.all([
    service
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    service
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lt("current_period_end", in30Days),
    service
      .from("pending_signups")
      .select("id", { count: "exact", head: true })
      .or(INCIDENT_FILTER),
    service
      .from("app_sync_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const nIncidents = incidents.count ?? 0;
  const nSync = syncTasks.count ?? 0;

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Tableau de bord</h1>
        <p className={s.pageDesc}>
          Vue d&apos;ensemble de la facturation : abonnements, incidents de
          provisioning et tâches de synchronisation avec l&apos;application.
        </p>
      </header>

      <div className={s.kpiGrid}>
        <Link href="/admin/billing/abonnements" className={s.kpiCard}>
          <span className={s.kpiLabel}>Abonnements actifs</span>
          <span className={s.kpiValue}>{actifs.count ?? 0}</span>
          <span className={s.kpiHint}>Souscriptions à jour de paiement</span>
        </Link>

        <Link href="/admin/billing/abonnements" className={s.kpiCard}>
          <span className={s.kpiLabel}>Échéances &lt; 30 jours</span>
          <span className={s.kpiValue}>{echeances.count ?? 0}</span>
          <span className={s.kpiHint}>
            Fins de période à renouveler (prélèvement SEPA)
          </span>
        </Link>

        <Link href="/admin/billing/incidents" className={s.kpiCard}>
          <span className={s.kpiLabel}>Incidents ouverts</span>
          <span
            className={`${s.kpiValue} ${nIncidents > 0 ? s.kpiValueAlert : ""}`}
          >
            {nIncidents}
          </span>
          <span className={s.kpiHint}>
            Conflits, écarts de montant, doubles paiements, échecs répétés
          </span>
        </Link>

        <Link href="/admin/billing/synchro" className={s.kpiCard}>
          <span className={s.kpiLabel}>Synchro en attente</span>
          <span className={`${s.kpiValue} ${nSync > 0 ? s.kpiValueWarn : ""}`}>
            {nSync}
          </span>
          <span className={s.kpiHint}>
            Tâches manuelles à reporter dans l&apos;application
          </span>
        </Link>
      </div>
    </>
  );
}
