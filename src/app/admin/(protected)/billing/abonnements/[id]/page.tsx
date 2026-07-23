import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { arreterReconduction } from "../actions";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Détail d'un abonnement : fiche complète + mandat SEPA lié,
   factures, notifications IPN de la référence et tâches de
   synchro. Server component en lecture seule.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Détail abonnement" };

type SubscriptionRow = {
  id: string;
  pending_signup_id: string | null;
  app_cabinet_id: string;
  app_user_id: string;
  cabinet_name: string;
  cabinet_email: string;
  admin_email: string;
  admin_name: string;
  invoice_prefix: string;
  plan: "MONTHLY" | "ANNUAL";
  extra_collaborators: number;
  first_payment_cents: number;
  renewal_amount_cents: number;
  currency: string;
  status: string;
  started_at: string;
  current_period_end: string;
  monetico_reference: string;
  monetico_order_date: string | null;
  renewal_count: number;
  last_renewal_at: string | null;
  recurrence_stopped_at: string | null;
  sepa_mandate_id: string | null;
  notes: string | null;
  created_at: string;
};

type MandateRow = {
  id: string;
  rum: string;
  status: string;
  scheme: string;
  iban_last4: string;
  bic: string | null;
  account_holder: string;
  signed_at: string | null;
  last_presented_at: string | null;
  legal_hold: boolean;
};

type InvoiceRow = {
  id: string;
  number: string;
  kind: string;
  amount_cents: number;
  currency: string;
  issued_at: string;
};

type IpnRow = {
  id: number;
  code_retour: string;
  amount_cents: number | null;
  currency: string | null;
  received_at: string;
};

type SyncTaskRow = {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
  done_at: string | null;
};

type ConsentRow = {
  id: string;
  label_text: string;
  documents: { document: string; version: string; sha256?: string }[];
  accepted_at: string;
  full_name: string;
  email: string;
  client_ip: string | null;
};

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Mensuel",
  ANNUAL: "Annuel",
};

const SUB_BADGE: Record<string, { label: string; tone: string }> = {
  active: { label: "Actif", tone: "tGreen" },
  pending_mandate: { label: "Mandat à signer", tone: "tAmber" },
  past_due: { label: "Impayé", tone: "tAmber" },
  suspended: { label: "Suspendu", tone: "tRed" },
  canceled: { label: "Résilié", tone: "tGray" },
  expired: { label: "Expiré", tone: "tGray" },
};

const MANDATE_BADGE: Record<string, { label: string; tone: string }> = {
  draft: { label: "Brouillon", tone: "tGray" },
  sent: { label: "Envoyé", tone: "tBlue" },
  signed: { label: "Signé", tone: "tGreen" },
  active: { label: "Actif", tone: "tGreen" },
  revoked: { label: "Révoqué", tone: "tRed" },
  lapsed: { label: "Caduc", tone: "tGray" },
};

const INVOICE_KIND: Record<string, string> = {
  card_first: "1er paiement carte",
  card_renewal: "Reconduction carte",
  sdd_renewal: "Renouvellement SEPA",
  credit_note: "Avoir",
};

const TASK_KIND: Record<string, string> = {
  renewal: "Renouvellement",
  suspension: "Suspension",
  reactivation: "Réactivation",
  rollback_renewal: "Annulation renouvellement",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function fmtDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}
function fmtDateTime(value: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

function badge(map: Record<string, { label: string; tone: string }>, status: string) {
  const b = map[status] ?? { label: status, tone: "tGray" };
  return <span className={`${s.badge} ${s[b.tone]}`}>{b.label}</span>;
}

export default async function AbonnementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = serviceClient();

  if (!service) {
    return (
      <p className={s.banner}>
        Supabase non configuré : le détail de l&apos;abonnement est
        indisponible.
      </p>
    );
  }

  const { data: subData } = await service
    .from("subscriptions")
    .select(
      "id, pending_signup_id, app_cabinet_id, app_user_id, cabinet_name, cabinet_email, admin_email, admin_name, invoice_prefix, plan, extra_collaborators, first_payment_cents, renewal_amount_cents, currency, status, started_at, current_period_end, monetico_reference, monetico_order_date, renewal_count, last_renewal_at, recurrence_stopped_at, sepa_mandate_id, notes, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!subData) notFound();
  const sub = subData as SubscriptionRow;

  const [mandates, invoices, ipns, tasks, consents] = await Promise.all([
    service
      .from("sepa_mandates")
      .select(
        "id, rum, status, scheme, iban_last4, bic, account_holder, signed_at, last_presented_at, legal_hold",
      )
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false }),
    service
      .from("invoices")
      .select("id, number, kind, amount_cents, currency, issued_at")
      .eq("subscription_id", sub.id)
      .order("issued_at", { ascending: false }),
    service
      .from("ipn_events")
      .select("id, code_retour, amount_cents, currency, received_at")
      .eq("reference", sub.monetico_reference)
      .order("received_at", { ascending: false }),
    service
      .from("app_sync_tasks")
      .select("id, kind, status, payload, created_at, done_at")
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false }),
    service
      .from("consent_records")
      .select("id, label_text, documents, accepted_at, full_name, email, client_ip")
      .eq("subscription_id", sub.id)
      .order("accepted_at", { ascending: false }),
  ]);

  const mandateRows = (mandates.data ?? []) as MandateRow[];
  const invoiceRows = (invoices.data ?? []) as InvoiceRow[];
  const ipnRows = (ipns.data ?? []) as IpnRow[];
  const taskRows = (tasks.data ?? []) as SyncTaskRow[];
  const consentRows = (consents.data ?? []) as ConsentRow[];

  return (
    <>
      <Link href="/admin/billing/abonnements" className={s.backLink}>
        ← Tous les abonnements
      </Link>

      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{sub.cabinet_name}</h1>
        <p className={s.pageDesc}>
          Abonnement {PLAN_LABEL[sub.plan] ?? sub.plan} —{" "}
          {badge(SUB_BADGE, sub.status)}
        </p>
      </header>

      <div className={s.detailGrid}>
        <section className={s.detailCard}>
          <h2>Souscription</h2>
          <dl className={s.detailList}>
            <dt>Statut</dt>
            <dd>{badge(SUB_BADGE, sub.status)}</dd>
            <dt>Plan</dt>
            <dd>
              {PLAN_LABEL[sub.plan] ?? sub.plan} — {sub.extra_collaborators}{" "}
              collaborateur(s) supplémentaire(s)
            </dd>
            <dt>1er paiement</dt>
            <dd>{formatEuros(sub.first_payment_cents)}</dd>
            <dt>Renouvellement</dt>
            <dd>{formatEuros(sub.renewal_amount_cents)}</dd>
            <dt>Début</dt>
            <dd>{fmtDate(sub.started_at)}</dd>
            <dt>Fin de période</dt>
            <dd>{fmtDate(sub.current_period_end)}</dd>
            <dt>Référence Monetico</dt>
            <dd className={s.mono}>{sub.monetico_reference}</dd>
            <dt>Préfixe factures</dt>
            <dd className={s.mono}>{sub.invoice_prefix}</dd>
            {sub.notes && (
              <>
                <dt>Notes</dt>
                <dd>{sub.notes}</dd>
              </>
            )}
          </dl>
        </section>

        <section className={s.detailCard}>
          <h2>Reconduction automatique</h2>
          <dl className={s.detailList}>
            <dt>État</dt>
            <dd>
              {sub.recurrence_stopped_at ? (
                <span className={`${s.badge} ${s.tGray}`}>Arrêtée</span>
              ) : (
                <span className={`${s.badge} ${s.tGreen}`}>Active</span>
              )}
            </dd>
            <dt>Échéances encaissées</dt>
            <dd>{sub.renewal_count}</dd>
            <dt>Dernière échéance</dt>
            <dd>{fmtDateTime(sub.last_renewal_at)}</dd>
            <dt>Prochaine échéance</dt>
            <dd>
              {sub.recurrence_stopped_at
                ? "—"
                : fmtDate(sub.current_period_end)}
            </dd>
            <dt>Montant reconduit</dt>
            <dd>{formatEuros(sub.renewal_amount_cents)}</dd>
            <dt>Date de commande</dt>
            <dd className={s.mono}>{sub.monetico_order_date ?? "—"}</dd>
            {sub.recurrence_stopped_at && (
              <>
                <dt>Arrêtée le</dt>
                <dd>{fmtDateTime(sub.recurrence_stopped_at)}</dd>
              </>
            )}
          </dl>

          {!sub.recurrence_stopped_at && (
            <form action={arreterReconduction} className={s.rowActions}>
              <input type="hidden" name="id" value={sub.id} />
              <label className={s.tdSub}>
                <input type="checkbox" name="confirm" required /> Je confirme
                l&apos;arrêt définitif de la reconduction
              </label>
              <button
                type="submit"
                className={`${s.btnSmall} ${s.btnSmallDanger}`}
              >
                Arrêter la reconduction
              </button>
            </form>
          )}
          <p className={s.tdSub}>
            L&apos;arrêt est envoyé à Monetico et n&apos;est enregistré ici que
            si la banque l&apos;accuse. L&apos;accès du client reste ouvert
            jusqu&apos;au terme de la période déjà réglée.
          </p>
        </section>

        <section className={s.detailCard}>
          <h2>Cabinet &amp; contact</h2>
          <dl className={s.detailList}>
            <dt>Cabinet</dt>
            <dd>{sub.cabinet_name}</dd>
            <dt>Email cabinet</dt>
            <dd>{sub.cabinet_email}</dd>
            <dt>Administrateur</dt>
            <dd>{sub.admin_name}</dd>
            <dt>Email admin</dt>
            <dd>{sub.admin_email}</dd>
            <dt>ID cabinet (app)</dt>
            <dd className={s.mono}>{sub.app_cabinet_id}</dd>
            <dt>ID user (app)</dt>
            <dd className={s.mono}>{sub.app_user_id}</dd>
            <dt>Créé le</dt>
            <dd>{fmtDateTime(sub.created_at)}</dd>
          </dl>
        </section>

        <section className={s.detailCard}>
          <h2>Mandat SEPA</h2>
          {mandateRows.length === 0 ? (
            <p className={s.empty}>Aucun mandat lié.</p>
          ) : (
            mandateRows.map((mandate) => (
              <dl className={s.detailList} key={mandate.id}>
                <dt>RUM</dt>
                <dd className={s.mono}>{mandate.rum}</dd>
                <dt>Statut</dt>
                <dd>
                  {badge(MANDATE_BADGE, mandate.status)}{" "}
                  {mandate.legal_hold && (
                    <span className={`${s.badge} ${s.tRed}`}>Litige</span>
                  )}
                </dd>
                <dt>Schéma</dt>
                <dd>{mandate.scheme}</dd>
                <dt>Titulaire</dt>
                <dd>{mandate.account_holder}</dd>
                <dt>IBAN</dt>
                <dd className={s.mono}>•••• {mandate.iban_last4}</dd>
                {mandate.bic && (
                  <>
                    <dt>BIC</dt>
                    <dd className={s.mono}>{mandate.bic}</dd>
                  </>
                )}
                <dt>Signé le</dt>
                <dd>{fmtDateTime(mandate.signed_at)}</dd>
                <dt>Dernière présentation</dt>
                <dd>{fmtDate(mandate.last_presented_at)}</dd>
              </dl>
            ))
          )}
        </section>

        <section className={s.detailCard}>
          <h2>Consentement contractuel</h2>
          {consentRows.length === 0 ? (
            <p className={s.empty}>Aucune preuve de consentement liée.</p>
          ) : (
            consentRows.map((consent) => (
              <dl className={s.detailList} key={consent.id}>
                <dt>Accepté le</dt>
                <dd>{fmtDateTime(consent.accepted_at)}</dd>
                <dt>Par</dt>
                <dd>
                  {consent.full_name} ({consent.email})
                  {consent.client_ip ? ` — IP ${consent.client_ip}` : ""}
                </dd>
                <dt>Documents</dt>
                <dd>
                  {consent.documents
                    .map((d) => `${d.document} v${d.version}`)
                    .join(" · ")}
                </dd>
                <dt>Libellé affiché</dt>
                <dd>{consent.label_text}</dd>
              </dl>
            ))
          )}
        </section>

        <section className={s.detailCard}>
          <h2>Factures ({invoiceRows.length})</h2>
          {invoiceRows.length === 0 ? (
            <p className={s.empty}>Aucune facture émise.</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Émise le</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className={s.mono}>{invoice.number}</td>
                      <td>{INVOICE_KIND[invoice.kind] ?? invoice.kind}</td>
                      <td className={s.tdNum}>
                        {formatEuros(invoice.amount_cents)}
                      </td>
                      <td className={s.tdNum}>{fmtDate(invoice.issued_at)}</td>
                      <td>
                        <a
                          href={`/admin/billing/factures/${invoice.id}/download`}
                          className={s.btnSmall}
                        >
                          Télécharger
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={s.detailCard}>
          <h2>Notifications de paiement (IPN)</h2>
          {ipnRows.length === 0 ? (
            <p className={s.empty}>Aucune notification reçue.</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Code retour</th>
                    <th>Montant</th>
                    <th>Reçue le</th>
                  </tr>
                </thead>
                <tbody>
                  {ipnRows.map((ipn) => (
                    <tr key={ipn.id}>
                      <td className={s.mono}>{ipn.code_retour}</td>
                      <td className={s.tdNum}>
                        {ipn.amount_cents != null
                          ? formatEuros(ipn.amount_cents)
                          : "—"}
                      </td>
                      <td className={s.tdNum}>{fmtDateTime(ipn.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={s.detailCard}>
          <h2>Tâches de synchro app</h2>
          {taskRows.length === 0 ? (
            <p className={s.empty}>Aucune tâche liée.</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Créée le</th>
                    <th>Faite le</th>
                  </tr>
                </thead>
                <tbody>
                  {taskRows.map((task) => (
                    <tr key={task.id}>
                      <td>{TASK_KIND[task.kind] ?? task.kind}</td>
                      <td>
                        <span
                          className={`${s.badge} ${
                            task.status === "pending"
                              ? s.tAmber
                              : task.status === "done"
                                ? s.tGreen
                                : s.tGray
                          }`}
                        >
                          {task.status === "pending"
                            ? "En attente"
                            : task.status === "done"
                              ? "Faite"
                              : "Annulée"}
                        </span>
                      </td>
                      <td className={s.tdNum}>{fmtDateTime(task.created_at)}</td>
                      <td className={s.tdNum}>{fmtDateTime(task.done_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
