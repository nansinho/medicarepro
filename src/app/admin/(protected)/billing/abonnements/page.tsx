import type { Metadata } from "next";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import s from "@/components/admin/Admin.module.css";

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

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Mensuel",
  ANNUAL: "Annuel",
};

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  active: { label: "Actif", tone: "tGreen" },
  pending_mandate: { label: "Mandat à signer", tone: "tAmber" },
  past_due: { label: "Impayé", tone: "tAmber" },
  suspended: { label: "Suspendu", tone: "tRed" },
  canceled: { label: "Résilié", tone: "tGray" },
  expired: { label: "Expiré", tone: "tGray" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

function fmtDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

export default async function AbonnementsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Abonnements</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : la liste des abonnements est indisponible.
        </p>
      </>
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
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Abonnements</h1>
        <p className={s.pageDesc}>
          Registre de facturation ({rows.length} affichés, 200 max). Le montant
          indiqué est celui du prochain renouvellement SEPA.
        </p>
      </header>

      {error && (
        <p className={s.banner}>Erreur de lecture : {error.message}</p>
      )}

      <div className={s.card}>
        {rows.length === 0 ? (
          <p className={s.empty}>Aucun abonnement pour le moment.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Cabinet</th>
                  <th>Plan</th>
                  <th>Collab.</th>
                  <th>Statut</th>
                  <th>Fin de période</th>
                  <th>Renouvellement</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((sub) => {
                  const badge = STATUS_BADGE[sub.status] ?? {
                    label: sub.status,
                    tone: "tGray",
                  };
                  return (
                    <tr key={sub.id}>
                      <td>
                        <span className={s.tdMain}>{sub.cabinet_name}</span>
                        <span className={s.tdSub}>{sub.admin_email}</span>
                      </td>
                      <td>{PLAN_LABEL[sub.plan] ?? sub.plan}</td>
                      <td className={s.tdNum}>{sub.extra_collaborators}</td>
                      <td>
                        <span
                          className={`${s.badge} ${s[badge.tone as keyof typeof s]}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className={s.tdNum}>
                        {fmtDate(sub.current_period_end)}
                      </td>
                      <td className={s.tdNum}>
                        {formatEuros(sub.renewal_amount_cents)}
                      </td>
                      <td>
                        <Link
                          href={`/admin/billing/abonnements/${sub.id}`}
                          className={s.btnSmall}
                        >
                          Détail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
