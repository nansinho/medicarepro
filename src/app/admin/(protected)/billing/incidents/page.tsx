import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { relancerProvisioning, marquerResolu } from "./actions";
import s from "@/components/admin/Admin.module.css";

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

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  failed_conflict: { label: "Conflit provisioning", tone: "tRed" },
  amount_mismatch: { label: "Montant inattendu", tone: "tRed" },
  duplicate_paid: { label: "Double paiement", tone: "tAmber" },
  paid: { label: "Échecs répétés", tone: "tAmber" },
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
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Incidents</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : la liste des incidents est indisponible.
        </p>
      </>
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
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Incidents</h1>
        <p className={s.pageDesc}>
          Dossiers payés en échec : conflits de provisioning, écarts de
          montant, doubles paiements et provisionings en échec répété.
          « Relancer » redonne le dossier au worker ; « Marquer résolu » clôt
          le dossier (abandonné ou remboursé manuellement).
        </p>
      </header>

      {error && (
        <p className={s.banner}>Erreur de lecture : {error.message}</p>
      )}

      <div className={s.card}>
        {rows.length === 0 ? (
          <p className={s.empty}>Aucun incident ouvert.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Cabinet</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Tentatives</th>
                  <th>Dernière erreur</th>
                  <th>Payé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((incident) => {
                  const badge = STATUS_BADGE[incident.status] ?? {
                    label: incident.status,
                    tone: "tGray",
                  };
                  return (
                    <tr key={incident.id}>
                      <td>
                        <span className={s.tdMain}>
                          {incident.cabinet_name ?? "—"}
                        </span>
                        <span className={s.tdSub}>
                          {PLAN_LABEL[incident.plan] ?? incident.plan} — créé le{" "}
                          {fmtDateTime(incident.created_at)}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={s.tdNum}>
                        {formatEuros(incident.amount_cents)}
                      </td>
                      <td className={s.tdNum}>{incident.provision_attempts}</td>
                      <td>
                        <span
                          className={s.truncate}
                          title={incident.last_error ?? undefined}
                        >
                          {incident.last_error ?? "—"}
                        </span>
                      </td>
                      <td className={s.tdNum}>{fmtDateTime(incident.paid_at)}</td>
                      <td>
                        <div className={s.rowActions}>
                          {incident.status === "paid" && (
                            <form action={relancerProvisioning}>
                              <input
                                type="hidden"
                                name="id"
                                value={incident.id}
                              />
                              <button type="submit" className={s.btnSmall}>
                                Relancer le provisioning
                              </button>
                            </form>
                          )}
                          <form action={marquerResolu}>
                            <input type="hidden" name="id" value={incident.id} />
                            <button
                              type="submit"
                              className={`${s.btnSmall} ${s.btnSmallDanger}`}
                            >
                              Marquer résolu
                            </button>
                          </form>
                        </div>
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
