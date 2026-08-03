import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { issueInvoice } from "@/lib/billing/invoices";
import { notifyRenewal } from "@/lib/provisioning";
import { formatEuros, planLabel, type BillingPlan } from "@/lib/checkout/pricing";
import {
  renewalReceiptEmail,
  billingAlertEmail,
} from "@/lib/emails/checkout-templates";

/* ============================================================
   Finalisation d'un RE-PAIEMENT d'abonnement annuel (self-service).

   Le client re-paie sur le TPE immédiat (encaissé d'office). Contrairement
   à une reconduction mensuelle (record_monetico_ipn) ou à un premier achat
   (worker), il n'y a NI provisioning, NI capture : le compte existe déjà,
   l'argent est déjà pris. On PROLONGE la souscription de 12 mois, on émet la
   facture, on remonte la date à l'app, et on prévient le client.

   Idempotent : le passage 'pending/paid' → 'extended' de subscription_renewals
   est le verrou (une re-présentation d'IPN ne prolonge jamais deux fois).
   ============================================================ */

const RENEWAL_MONTHS = 12;

type RenewalRow = {
  id: string;
  subscription_id: string;
  monetico_reference: string;
  amount_cents: number;
  currency: string;
  status: string;
};

type SubRow = {
  id: string;
  app_cabinet_id: string;
  cabinet_name: string;
  cabinet_address: string;
  cabinet_postal_city: string;
  admin_email: string;
  admin_name: string;
  invoice_prefix: string;
  plan: BillingPlan;
  extra_collaborators: number;
  renewal_amount_cents: number;
  renewal_count: number;
  current_period_end: string;
  currency: string;
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** date + N mois, jour du mois borné (comme le worker). */
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

function frDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

function frDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[renewal-payment] échec alerte :", errMessage(err));
  }
}

/**
 * Traite un paiement de renouvellement accepté. Best-effort après le verrou :
 * l'appelant (IPN) doit acquitter Monetico quoi qu'il arrive.
 */
export async function finalizeAnnualRenewal(input: {
  reference: string;
  occurredAt: Date;
  amountCents: number | null;
  currency: string | null;
}): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data: rData, error: rErr } = await supabase
    .from("subscription_renewals")
    .select("id, subscription_id, monetico_reference, amount_cents, currency, status")
    .eq("monetico_reference", input.reference)
    .maybeSingle();
  if (rErr || !rData) return;
  const renewal = rData as RenewalRow;
  if (renewal.status === "extended") return; // déjà appliqué (replay)

  const paidCents = input.amountCents ?? renewal.amount_cents;

  // Garde montant : l'argent encaissé doit être exactement l'attendu.
  if (paidCents !== renewal.amount_cents) {
    await supabase
      .from("subscription_renewals")
      .update({ status: "amount_mismatch", paid_at: input.occurredAt.toISOString() })
      .eq("id", renewal.id)
      .eq("status", "pending");
    await sendBillingAlert("URGENT — Renouvellement : montant inattendu", [
      `Référence : ${input.reference}`,
      `Montant encaissé : ${formatEuros(paidCents)}`,
      `Montant attendu : ${formatEuros(renewal.amount_cents)}`,
      "La souscription n'a PAS été prolongée. Vérifier et régulariser à la main.",
    ]);
    return;
  }

  const { data: sData, error: sErr } = await supabase
    .from("subscriptions")
    .select(
      "id, app_cabinet_id, cabinet_name, cabinet_address, cabinet_postal_city, admin_email, admin_name, invoice_prefix, plan, extra_collaborators, renewal_amount_cents, renewal_count, current_period_end, currency",
    )
    .eq("id", renewal.subscription_id)
    .maybeSingle();
  if (sErr || !sData) {
    await sendBillingAlert("Renouvellement sans souscription retrouvée", [
      `Référence : ${input.reference}`,
      "Le paiement est encaissé mais la souscription est introuvable — prolongation à faire à la main.",
    ]);
    return;
  }
  const sub = sData as SubRow;

  // Prolongation depuis la plus tardive de (échéance actuelle, maintenant) :
  // un renouvellement anticipé ne perd pas de jours, un renouvellement tardif
  // repart de zéro.
  const base = new Date(
    Math.max(new Date(sub.current_period_end).getTime(), input.occurredAt.getTime()),
  );
  const newPeriodEnd = addMonthsClamped(base, RENEWAL_MONTHS);

  // VERROU : pending/paid → extended. Si 0 ligne, c'est un rejeu : on s'arrête.
  const { data: claimed } = await supabase
    .from("subscription_renewals")
    .update({
      status: "extended",
      paid_at: input.occurredAt.toISOString(),
      new_period_end: newPeriodEnd.toISOString(),
    })
    .eq("id", renewal.id)
    .in("status", ["pending", "paid"])
    .select("id");
  if (!claimed || claimed.length === 0) return; // déjà pris par un autre passage

  // 1. Prolonge la souscription (valeur ABSOLUE : sûre même si rejoué).
  await supabase
    .from("subscriptions")
    .update({
      current_period_end: newPeriodEnd.toISOString(),
      status: "active",
      renewal_count: sub.renewal_count + 1,
      last_renewal_at: input.occurredAt.toISOString(),
    })
    .eq("id", sub.id);

  // 2. Pièce comptable — encaissée d'office (TPE immédiat).
  await supabase.from("billing_ledger").insert({
    event_type: "card_renewal",
    amount_cents: paidCents,
    currency: input.currency ?? sub.currency,
    occurred_at: input.occurredAt.toISOString(),
    captured_at: input.occurredAt.toISOString(),
    reference: input.reference,
    subscription_id: sub.id,
    cabinet_name: sub.cabinet_name,
    meta: { kind: "annual_renewal" },
  });

  const label = planLabel(sub.plan, sub.extra_collaborators);
  const firstName = sub.admin_name.trim().split(/\s+/)[0] ?? "";

  // 3. Facture (best-effort).
  let invoiceNumber: string | undefined;
  try {
    const invoice = await issueInvoice({
      kind: "card_renewal",
      amountCents: paidCents,
      currency: input.currency ?? sub.currency,
      subscriptionId: sub.id,
      cabinetName: sub.cabinet_name,
      cabinetAddress: sub.cabinet_address,
      cabinetPostalCity: sub.cabinet_postal_city,
      planLabel: label,
      reference: input.reference,
    });
    invoiceNumber = invoice.number;
  } catch (err) {
    console.error("[renewal-payment] échec facture :", errMessage(err));
  }

  // 4. Reçu au client (accès prolongé, offre annuelle).
  try {
    const receipt = renewalReceiptEmail({
      adminFirstName: firstName,
      cabinetName: sub.cabinet_name,
      planLabel: label,
      amountLabel: formatEuros(paidCents),
      reference: input.reference,
      paidAtLabel: frDateTime(input.occurredAt),
      periodEndLabel: frDate(newPeriodEnd),
      invoiceNumber,
    });
    await sendMail({ to: sub.admin_email, ...receipt });
  } catch (err) {
    console.error("[renewal-payment] échec reçu :", errMessage(err));
  }

  // 5. Remontée de la nouvelle échéance à l'app (no-op si flag off).
  try {
    const sync = await notifyRenewal({
      idempotencyKey: `${input.reference}-renew`,
      cabinetId: sub.app_cabinet_id,
      plan: sub.plan,
      periodEnd: newPeriodEnd.toISOString(),
      paidAt: input.occurredAt.toISOString(),
      amountCents: paidCents,
      currency: input.currency ?? sub.currency,
    });
    if (!sync.ok) {
      await sendBillingAlert("Renouvellement non remonté à l'application", [
        `Cabinet : ${sub.cabinet_name}`,
        `Référence : ${input.reference}`,
        `Nouvelle échéance : ${frDate(newPeriodEnd)}`,
        `Erreur : ${sync.reason}`,
        "L'encaissement et la facture sont faits ; seule la date affichée dans l'app reste à corriger.",
      ]);
    }
  } catch (err) {
    console.error("[renewal-payment] échec remontée :", errMessage(err));
  }

  await logAudit({
    action: "billing.annual_renewal_extended",
    entityType: "subscription",
    entityId: sub.id,
    diff: { reference: input.reference, newPeriodEnd: newPeriodEnd.toISOString() },
  });
}
