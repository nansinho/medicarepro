import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { issueInvoice } from "@/lib/billing/invoices";
import { formatEuros, planLabel, type BillingPlan } from "@/lib/checkout/pricing";
import {
  renewalReceiptEmail,
  billingAlertEmail,
} from "@/lib/emails/checkout-templates";

/* ============================================================
   Finalisation d'une échéance de reconduction (TPE Monetico
   « Paiement Récurrent »).

   La partie qui engage l'argent est déjà faite, en base et dans
   la même transaction que le journal IPN (record_monetico_ipn) :
   écriture au billing_ledger, prolongation de current_period_end,
   compteur d'échéances. Ici on ne fait que le prolongement
   documentaire — facture, reçu, alerte — chaque étape isolée pour
   qu'un échec (SMTP, Storage) n'en empêche pas une autre.

   RÈGLE : aucune donnée bancaire ne transite ici, et les erreurs
   ne portent que des messages courts.
   ============================================================ */

type SubscriptionRow = {
  id: string;
  cabinet_name: string;
  cabinet_address: string;
  cabinet_postal_city: string;
  admin_email: string;
  admin_name: string;
  plan: BillingPlan;
  extra_collaborators: number;
  renewal_amount_cents: number;
  currency: string;
  current_period_end: string;
  renewal_count: number;
};

export type FinalizeRenewalInput = {
  /** Référence Monetico de la commande initiale (stable sur toute la série). */
  reference: string;
  /** Date du débit, telle que notifiée par Monetico. */
  occurredAt: Date;
  /** Montant réellement encaissé (centimes), null si l'IPN ne le portait pas. */
  amountCents: number | null;
  /** Le montant encaissé diffère du montant de reconduction attendu. */
  amountMismatch: boolean;
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** "11 juillet 2026 à 14:32" — horodatage lisible (heure de Paris). */
function frDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** "11 juillet 2027" — date seule (fin de période couverte). */
function frDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** Alerte billing interne — best-effort, ne jette jamais. */
async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-renewals] échec alerte billing :", errMessage(err));
  }
}

/**
 * Facture, reçoit et alerte pour une échéance de reconduction déjà
 * comptabilisée. Best-effort : ne jette jamais (l'appelant est la route IPN,
 * qui doit acquitter Monetico quoi qu'il arrive).
 */
export async function finalizeRenewal(
  input: FinalizeRenewalInput,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, cabinet_name, cabinet_address, cabinet_postal_city, admin_email, admin_name, plan, extra_collaborators, renewal_amount_cents, currency, current_period_end, renewal_count",
    )
    .eq("monetico_reference", input.reference)
    .maybeSingle();
  if (error || !data) {
    await sendBillingAlert("Reconduction sans souscription retrouvée", [
      `Référence : ${input.reference}`,
      "L'échéance a été comptabilisée mais la souscription est introuvable — facture et reçu à émettre à la main.",
    ]);
    return;
  }

  const sub = data as SubscriptionRow;
  const amountCents = input.amountCents ?? sub.renewal_amount_cents;
  const label = planLabel(sub.plan, sub.extra_collaborators);
  const firstName = sub.admin_name.trim().split(/\s+/)[0] ?? "";
  const periodEnd = new Date(sub.current_period_end);

  /* --- Montant inattendu : l'argent est encaissé, on ne bloque rien,
     mais l'équipe doit trancher (changement de barème ? collaborateur
     ajouté côté app ? erreur de configuration du TPE ?). */
  if (input.amountMismatch) {
    await sendBillingAlert("URGENT — Montant de reconduction inattendu", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Montant encaissé : ${formatEuros(amountCents)}`,
      `Montant attendu : ${formatEuros(sub.renewal_amount_cents)}`,
      "L'échéance a été comptabilisée et la période prolongée. Vérifier le paramétrage du TPE récurrent et régulariser si nécessaire.",
    ]);
  }

  // Facture de reconduction.
  let invoiceNumber: string | undefined;
  try {
    const invoice = await issueInvoice({
      kind: "card_renewal",
      amountCents,
      currency: sub.currency,
      subscriptionId: sub.id,
      cabinetName: sub.cabinet_name,
      cabinetAddress: sub.cabinet_address,
      cabinetPostalCity: sub.cabinet_postal_city,
      planLabel: label,
      reference: input.reference,
    });
    invoiceNumber = invoice.number;
  } catch (err) {
    console.error(
      "[billing-renewals] échec facture card_renewal :",
      errMessage(err),
    );
    await sendBillingAlert("Facture de reconduction non émise", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(amountCents)}`,
      `Erreur : ${errMessage(err)}`,
      "L'échéance est encaissée et comptabilisée : la facture doit être émise à la main.",
    ]);
  }

  // Reçu au client.
  try {
    const receipt = renewalReceiptEmail({
      adminFirstName: firstName,
      cabinetName: sub.cabinet_name,
      planLabel: label,
      amountLabel: formatEuros(amountCents),
      reference: input.reference,
      paidAtLabel: frDateTime(input.occurredAt),
      periodEndLabel: frDate(periodEnd),
      invoiceNumber,
    });
    await sendMail({ to: sub.admin_email, ...receipt });
  } catch (err) {
    console.error("[billing-renewals] échec email reçu :", errMessage(err));
  }

  await logAudit({
    action: "billing.renewal_collected",
    entityType: "subscription",
    entityId: sub.id,
    diff: {
      reference: input.reference,
      amountCents,
      renewalCount: sub.renewal_count,
      periodEnd: sub.current_period_end,
    },
  });
}
