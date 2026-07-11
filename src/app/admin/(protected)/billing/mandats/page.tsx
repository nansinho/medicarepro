import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Registre des mandats SEPA. Un mandat Core devient CADUC 36 mois
   après sa dernière présentation (collectée ou rejetée) — ou après
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

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  draft: { label: "Brouillon", tone: "tGray" },
  sent: { label: "Envoyé", tone: "tBlue" },
  signed: { label: "Signé", tone: "tGreen" },
  active: { label: "Actif", tone: "tGreen" },
  revoked: { label: "Révoqué", tone: "tRed" },
  lapsed: { label: "Caduc", tone: "tGray" },
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
    signature à défaut) — null si le mandat n'est pas encore prélevable. */
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
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Mandats SEPA</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : le registre des mandats est indisponible.
        </p>
      </>
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
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Mandats SEPA</h1>
        <p className={s.pageDesc}>
          Registre des mandats de prélèvement (Core). Un mandat sans
          présentation pendant 36 mois devient caduc — signalé ici dès 33
          mois pour représenter à temps.
        </p>
      </header>

      {error && (
        <p className={s.banner}>Erreur de lecture : {error.message}</p>
      )}

      <div className={s.card}>
        {rows.length === 0 ? (
          <p className={s.empty}>Aucun mandat pour le moment.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>RUM</th>
                  <th>Cabinet</th>
                  <th>Statut</th>
                  <th>IBAN</th>
                  <th>Signé le</th>
                  <th>Dernière présentation</th>
                  <th>Caducité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((mandate) => {
                  const badge = STATUS_BADGE[mandate.status] ?? {
                    label: mandate.status,
                    tone: "tGray",
                  };
                  const lapse = lapseInfo(mandate);
                  return (
                    <tr key={mandate.id}>
                      <td className={`${s.tdMain} ${s.mono}`}>{mandate.rum}</td>
                      <td>{mandate.subscription?.cabinet_name ?? "—"}</td>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>{" "}
                        {mandate.legal_hold && (
                          <span className={`${s.badge} ${s.tRed}`}>Litige</span>
                        )}
                      </td>
                      <td className={`${s.tdNum} ${s.mono}`}>
                        •••• {mandate.iban_last4}
                      </td>
                      <td className={s.tdNum}>{fmtDate(mandate.signed_at)}</td>
                      <td className={s.tdNum}>
                        {fmtDate(mandate.last_presented_at)}
                      </td>
                      <td className={s.tdNum}>
                        {lapse ? (
                          lapse.overdue ? (
                            <span className={s.dangerText}>
                              Caduc depuis le{" "}
                              {dateFmt.format(lapse.lapseAt)}
                            </span>
                          ) : lapse.soon ? (
                            <span className={s.warnText}>
                              Caduc bientôt — le{" "}
                              {dateFmt.format(lapse.lapseAt)}
                            </span>
                          ) : (
                            <>le {dateFmt.format(lapse.lapseAt)}</>
                          )
                        ) : (
                          "—"
                        )}
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
