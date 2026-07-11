import type { Metadata } from "next";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Factures émises (pièces comptables, PDF dans le bucket privé
   'billing'). « Télécharger » passe par la route /download qui
   re-vérifie le rôle admin puis redirige vers une URL signée
   courte (60 s). Pas de FK invoices→subscriptions : le nom du
   cabinet est résolu par un second lookup.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Factures" };

type InvoiceRow = {
  id: string;
  number: string;
  subscription_id: string | null;
  kind: string;
  amount_cents: number;
  currency: string;
  issued_at: string;
};

const KIND_BADGE: Record<string, { label: string; tone: string }> = {
  card_first: { label: "1er paiement carte", tone: "tBlue" },
  sdd_renewal: { label: "Renouvellement SEPA", tone: "tGreen" },
  credit_note: { label: "Avoir", tone: "tAmber" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

export default async function FacturesPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Factures</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : la liste des factures est indisponible.
        </p>
      </>
    );
  }

  const { data, error } = await service
    .from("invoices")
    .select("id, number, subscription_id, kind, amount_cents, currency, issued_at")
    .order("issued_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as InvoiceRow[];

  /* Noms de cabinet des abonnements liés (pas de FK → pas d'embedding). */
  const subscriptionIds = [
    ...new Set(
      rows
        .map((invoice) => invoice.subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cabinetById = new Map<string, string>();
  if (subscriptionIds.length > 0) {
    const { data: subs } = await service
      .from("subscriptions")
      .select("id, cabinet_name")
      .in("id", subscriptionIds);
    for (const sub of (subs ?? []) as { id: string; cabinet_name: string }[]) {
      cabinetById.set(sub.id, sub.cabinet_name);
    }
  }

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Factures</h1>
        <p className={s.pageDesc}>
          Factures émises ({rows.length} affichées, 200 max). Le
          téléchargement passe par une URL signée à durée courte — le PDF
          n&apos;est jamais public.
        </p>
      </header>

      {error && (
        <p className={s.banner}>Erreur de lecture : {error.message}</p>
      )}

      <div className={s.card}>
        {rows.length === 0 ? (
          <p className={s.empty}>Aucune facture émise pour le moment.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Abonnement</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Émise le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const badge = KIND_BADGE[invoice.kind] ?? {
                    label: invoice.kind,
                    tone: "tGray",
                  };
                  const cabinet = invoice.subscription_id
                    ? cabinetById.get(invoice.subscription_id)
                    : undefined;
                  return (
                    <tr key={invoice.id}>
                      <td className={`${s.tdMain} ${s.mono}`}>
                        {invoice.number}
                      </td>
                      <td>
                        {invoice.subscription_id && cabinet ? (
                          <Link
                            href={`/admin/billing/abonnements/${invoice.subscription_id}`}
                          >
                            {cabinet}
                          </Link>
                        ) : (
                          (cabinet ?? "—")
                        )}
                      </td>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={s.tdNum}>
                        {formatEuros(invoice.amount_cents)}
                      </td>
                      <td className={s.tdNum}>
                        {dateFmt.format(new Date(invoice.issued_at))}
                      </td>
                      <td>
                        <a
                          href={`/admin/billing/factures/${invoice.id}/download`}
                          className={s.btnSmall}
                        >
                          Télécharger
                        </a>
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
