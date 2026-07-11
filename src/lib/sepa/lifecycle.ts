import { parisYmd } from "@/lib/sepa/business-days";

/* ============================================================
   Cycle de vie des mandats SEPA — helpers PURS (aucun accès
   base), utilisés par le tunnel et les crons BILLING-2.

   Règle de caducité (rulebook Core) : un mandat sans présentation
   pendant 36 mois devient caduc (« lapsed ») et ne peut plus être
   utilisé — il faut en signer un nouveau.
   ============================================================ */

/** Statuts sous lesquels un mandat peut être présenté au débit. */
const USABLE_STATUSES = new Set(["signed", "active"]);

/** Caducité d'un mandat Core : 36 mois sans présentation. */
export const MANDATE_LAPSE_MONTHS = 36;

export type MandateLifecycleInput = {
  /** sepa_mandates.status : 'draft'|'sent'|'signed'|'active'|'revoked'|'lapsed'. */
  status: string;
  /** Dernière présentation en banque (ISO ou Date), sinon null. */
  last_presented_at: string | Date | null;
  /** Date de signature (ISO ou Date), sinon null. */
  signed_at: string | Date | null;
};

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Le mandat peut-il être utilisé pour un prélèvement ?
 * Vrai si le statut est signed|active ET que moins de 36 mois se
 * sont écoulés depuis coalesce(last_presented_at, signed_at).
 */
export function mandateIsUsable(
  m: MandateLifecycleInput,
  now: Date = new Date(),
): boolean {
  if (!USABLE_STATUSES.has(m.status)) return false;
  const anchor = toDate(m.last_presented_at) ?? toDate(m.signed_at);
  if (!anchor) return false; // jamais signé ni présenté → inutilisable
  const lapsesAt = new Date(anchor.getTime());
  lapsesAt.setUTCMonth(lapsesAt.getUTCMonth() + MANDATE_LAPSE_MONTHS);
  return now.getTime() < lapsesAt.getTime();
}

/**
 * La pré-notification respecte-t-elle le délai légal avant débit ?
 * Comparaison en jours CALENDAIRES entre les jours civils
 * Europe/Paris de l'envoi et de l'échéance (14 jours minimum,
 * sauf accord contractuel réduisant le délai).
 */
export function prenotifyDeadlineOk(
  prenotifiedAt: Date,
  collectionDate: Date,
  minDays = 14,
): boolean {
  const sent = parisYmd(prenotifiedAt);
  const due = parisYmd(collectionDate);
  const diffDays = Math.round(
    (Date.UTC(due.year, due.month - 1, due.day) -
      Date.UTC(sent.year, sent.month - 1, sent.day)) /
      86_400_000,
  );
  return diffDays >= minDays;
}
