import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { formatEuros } from "@/lib/checkout/pricing";
import { markOrderFailed } from "@/lib/billing/orders";
import { notifyRenewal } from "@/lib/provisioning";
import {
  paymentFailedEmail,
  billingAlertEmail,
} from "@/lib/emails/checkout-templates";

/* ============================================================
   Échéance REFUSÉE par la banque.

   POURQUOI CE FICHIER EXISTE : jusqu'ici, un refus de prélèvement ne
   déclenchait rien du tout. Le code-retour 'Annulation' sur un dossier déjà
   provisionné retombe en 'stale' dans record_monetico_ipn, et la route IPN
   l'ignorait explicitement. Concrètement : la carte d'un client expirait,
   l'argent cessait d'entrer, le client gardait son accès, et personne ne
   l'apprenait — sauf à lire ipn_events à la main.

   Ce que fait `registerPaymentFailure` : pose l'abonnement en `past_due`,
   ouvre (ou prolonge) une série d'impayés avec son délai de grâce, prévient
   le client et l'équipe. Il ne touche JAMAIS au billing_ledger : aucun argent
   n'a bougé, il n'y a donc aucune pièce comptable à écrire.

   Best-effort de bout en bout : un refus mal traité ne doit jamais empêcher
   l'acquittement de la notification à Monetico.
   ============================================================ */

/** Durée de grâce après le premier refus, avant restriction d'accès. */
export const GRACE_DAYS = 14;

type SubRow = {
  id: string;
  app_cabinet_id: string;
  cabinet_name: string;
  admin_email: string;
  admin_name: string;
  status: string;
  plan: string;
  renewal_amount_cents: number;
  dunning_started_at: string | null;
  dunning_failure_count: number;
  grace_until: string | null;
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

function frDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[dunning] échec alerte :", errMessage(err));
  }
}

/**
 * Traite un refus de paiement notifié par Monetico.
 *
 * La référence peut désigner deux choses différentes :
 *   - un abonnement (échéance de reconduction du TPE récurrent) ;
 *   - un dossier de renouvellement annuel ouvert par le client.
 * On traite les deux, dans cet ordre.
 *
 * Ne jette jamais.
 */
export async function registerPaymentFailure(input: {
  reference: string;
  codeRetour: string;
  occurredAt: Date;
}): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  /* --- 1. Échéance de reconduction d'un abonnement --------------------- */

  const { data: subData } = await supabase
    .from("subscriptions")
    .select(
      "id, app_cabinet_id, cabinet_name, admin_email, admin_name, status, plan, renewal_amount_cents, dunning_started_at, dunning_failure_count, grace_until",
    )
    .eq("monetico_reference", input.reference)
    .maybeSingle();

  if (subData) {
    const sub = subData as SubRow;

    /* Abonnement déjà résilié : un refus est ici la conséquence NORMALE de
       l'arrêt de récurrence. Aucune relance, aucun email au client. */
    if (sub.status === "canceled" || sub.status === "expired") {
      await logAudit({
        action: "billing.payment_refused_ignored",
        entityType: "subscription",
        entityId: sub.id,
        diff: { reference: input.reference, status: sub.status },
      });
      return;
    }

    const attempt = sub.dunning_failure_count + 1;
    const startedAt = sub.dunning_started_at
      ? new Date(sub.dunning_started_at)
      : input.occurredAt;
    const graceUntil = sub.grace_until
      ? new Date(sub.grace_until)
      : new Date(startedAt.getTime() + GRACE_DAYS * 86_400_000);

    /* 'suspended' est un état plus avancé que 'past_due' : on ne redescend
       pas. Les autres états actifs basculent en impayé. */
    const nextStatus = sub.status === "suspended" ? "suspended" : "past_due";

    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({
        status: nextStatus,
        dunning_started_at: startedAt.toISOString(),
        dunning_failure_count: attempt,
        last_failure_at: input.occurredAt.toISOString(),
        last_failure_code: input.codeRetour,
        grace_until: graceUntil.toISOString(),
      })
      .eq("id", sub.id);
    if (updErr) {
      console.error("[dunning] update subscription :", updErr.message);
    }

    const firstName = sub.admin_name.trim().split(/\s+/)[0] ?? "";

    // Le client d'abord : c'est lui qui peut agir.
    try {
      const mail = paymentFailedEmail({
        adminFirstName: firstName,
        cabinetName: sub.cabinet_name,
        amountLabel: formatEuros(sub.renewal_amount_cents),
        graceUntilLabel: frDate(graceUntil),
        attempt,
      });
      await sendMail({ to: sub.admin_email, ...mail });
    } catch (err) {
      console.error("[dunning] échec email client :", errMessage(err));
    }

    /* Remontée à l'application : c'est elle qui affiche le bandeau au
       praticien. Sans cet appel, un impayé resterait invisible là où il
       travaille — et la relance ne reposerait que sur des emails. */
    try {
      await notifyRenewal({
        idempotencyKey: `${input.reference}-fail-${attempt}`,
        cabinetId: sub.app_cabinet_id,
        plan: sub.plan as "MONTHLY" | "ANNUAL",
        status: "PAST_DUE",
        graceUntil: graceUntil.toISOString(),
      });
    } catch (err) {
      console.error("[dunning] échec remontée impayé :", errMessage(err));
    }

    await sendBillingAlert("Échéance refusée par la banque", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Formule : ${sub.plan}`,
      `Montant attendu : ${formatEuros(sub.renewal_amount_cents)}`,
      `Code-retour : ${input.codeRetour}`,
      `Refus consécutifs : ${attempt}`,
      `Accès garanti jusqu'au : ${frDate(graceUntil)}`,
      "Le client a été prévenu. La commande récurrente reste vivante côté banque : elle re-présentera peut-être l'échéance.",
    ]);

    await logAudit({
      action: "billing.payment_refused",
      entityType: "subscription",
      entityId: sub.id,
      diff: {
        reference: input.reference,
        codeRetour: input.codeRetour,
        attempt,
        graceUntil: graceUntil.toISOString(),
      },
    });
    return;
  }

  /* --- 2. Commande hors tunnel (souscription, changement de carte…) ----- */

  const { data: orderData } = await supabase
    .from("subscription_orders")
    .select("id, kind, amount_cents, status, app_cabinet_id, billing_snapshot")
    .eq("monetico_reference", input.reference)
    .maybeSingle();

  if (orderData) {
    const order = orderData as {
      id: string;
      kind: string;
      amount_cents: number;
      status: string;
      app_cabinet_id: string;
      billing_snapshot: { cabinetName?: string };
    };
    if (order.status !== "pending") return; // déjà tranché

    await markOrderFailed(supabase, order.id);

    /* Pas d'email : le client vient de voir le refus sur sa page de retour et
       peut relancer immédiatement. L'équipe, elle, doit savoir qu'une
       souscription a échoué — c'est un client perdu si personne ne rappelle. */
    await sendBillingAlert("Commande refusée par la banque", [
      `Cabinet : ${order.billing_snapshot?.cabinetName ?? order.app_cabinet_id}`,
      `Type : ${order.kind}`,
      `Référence : ${input.reference}`,
      `Montant attendu : ${formatEuros(order.amount_cents)}`,
      `Code-retour : ${input.codeRetour}`,
      "Aucun contrat n'a été créé. Le client peut réessayer depuis son espace abonnement.",
    ]);

    await logAudit({
      action: "billing.order_refused",
      entityType: "subscription_order",
      entityId: order.id,
      diff: { reference: input.reference, codeRetour: input.codeRetour },
    });
    return;
  }

  /* --- 3. Re-paiement de renouvellement annuel ------------------------- */

  const { data: renewalData } = await supabase
    .from("subscription_renewals")
    .select("id, subscription_id, amount_cents, status")
    .eq("monetico_reference", input.reference)
    .maybeSingle();

  if (!renewalData) return; // référence inconnue : l'appelant alerte déjà

  const renewal = renewalData as {
    id: string;
    subscription_id: string;
    amount_cents: number;
    status: string;
  };
  if (renewal.status !== "pending") return; // déjà tranché

  await supabase
    .from("subscription_renewals")
    .update({ status: "refused" })
    .eq("id", renewal.id)
    .eq("status", "pending");

  /* Pas d'email ici : le client vient de voir l'échec sur la page de retour
     du paiement. Le prévenir une seconde fois par courriel serait redondant
     et anxiogène. L'équipe, elle, doit le savoir. */
  await sendBillingAlert("Renouvellement annuel refusé", [
    `Référence : ${input.reference}`,
    `Montant attendu : ${formatEuros(renewal.amount_cents)}`,
    `Code-retour : ${input.codeRetour}`,
    "Le dossier de renouvellement est clos en 'refused'. L'abonnement n'a PAS été prolongé : son échéance reste inchangée et les rappels continueront.",
  ]);

  await logAudit({
    action: "billing.renewal_refused",
    entityType: "subscription",
    entityId: renewal.subscription_id,
    diff: { reference: input.reference, codeRetour: input.codeRetour },
  });
}
