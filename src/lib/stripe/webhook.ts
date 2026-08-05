import "server-only";
import type Stripe from "stripe";
import { stripe, stripeLiveMode } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/env";

/* ============================================================
   Notifications Stripe : authentifier, puis projeter.

   DEUX RÈGLES, TOUTES DEUX PAYÉES CHER LE 05/08/2026.

   1. On n'agit jamais sur un message qu'on n'a pas authentifié. Sans
      vérification de signature, un `invoice.paid` fabriqué par n'importe qui
      prolongerait une période sans qu'un centime soit entré, et un
      `checkout.session.completed` inventé créerait un abonnement gratuit.

   2. On ne journalise que ce qu'on accepte de conserver. La charge utile de
      Stripe contient les quatre derniers chiffres de la carte, son pays
      d'émission, l'empreinte du moyen de paiement. Rien de tout cela n'a à
      entrer dans notre base : on n'en projette que le verdict et les montants,
      comme `filterIpnForStorage` le fait déjà pour Monetico.
   ============================================================ */

/** Ce qu'on garde d'un événement, et rien de plus. */
export type StripeEventRecord = {
  eventId: string;
  type: string;
  livemode: boolean;
  /** Notre référence « MP + 10 », quand l'objet la porte. */
  reference: string | null;
  /** `cs_…`, `in_…`, `sub_…` selon le type. */
  stripeObjectId: string | null;
  amountCents: number | null;
  currency: string | null;
  payload: Record<string, unknown>;
};

/**
 * Authentifie une notification à partir du CORPS BRUT.
 *
 * Le corps doit être la chaîne reçue telle quelle : re-sérialiser du JSON
 * change les espaces et invalide la signature. C'est l'erreur classique, et
 * elle se manifeste par un rejet total et permanent, jamais intermittent.
 *
 * Ne jette pas : renvoie l'événement ou la raison du refus, pour que la route
 * puisse journaliser un refus au lieu de le laisser disparaître.
 */
export function verifyStripeEvent(
  rawBody: string,
  signature: string | null,
): { ok: true; event: Stripe.Event } | { ok: false; reason: string } {
  const secret = stripeConfig().webhookSecret;
  if (!secret) {
    return { ok: false, reason: "Secret de webhook Stripe manquant" };
  }
  if (!signature) return { ok: false, reason: "en-tête stripe-signature absent" };
  try {
    const event = stripe().webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message.slice(0, 200) : "signature invalide",
    };
  }
}

/**
 * L'événement vient-il du même monde que nos clés ?
 *
 * Une notification d'essai ne doit JAMAIS muter un contrat réel, ni l'inverse.
 * C'est exactement le décalage qui a rendu injoignables les sept abonnements
 * existants : ils vivaient sur la plateforme d'essai de Monetico pendant que le
 * site interrogeait la production.
 */
export function eventMatchesEnvironment(event: Stripe.Event): boolean {
  return event.livemode === stripeLiveMode();
}

/** Notre référence, cherchée là où Stripe la range selon le type d'objet. */
function referenceOf(obj: Record<string, unknown>): string | null {
  const direct = obj["client_reference_id"];
  if (typeof direct === "string" && direct) return direct;
  const meta = obj["metadata"];
  if (meta && typeof meta === "object") {
    const ref = (meta as Record<string, unknown>)["reference"];
    if (typeof ref === "string" && ref) return ref;
  }
  return null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/**
 * Projette un événement en ce qu'on garde.
 *
 * Liste BLANCHE, pas liste noire : on énumère ce qui entre, plutôt que ce qui
 * est interdit. Une liste noire laisse passer le champ que Stripe ajoutera
 * demain, et c'est ainsi qu'une donnée carte finit en base sans que personne
 * l'ait décidé.
 */
export function projectStripeEvent(event: Stripe.Event): StripeEventRecord {
  const obj = event.data.object as unknown as Record<string, unknown>;

  const payload: Record<string, unknown> = {};
  const garder = (cle: string, valeur: unknown) => {
    if (valeur !== undefined && valeur !== null) payload[cle] = valeur;
  };
  garder("status", stringOrNull(obj["status"]));
  garder("payment_status", stringOrNull(obj["payment_status"]));
  garder("customer", stringOrNull(obj["customer"]));
  garder("subscription", stringOrNull(obj["subscription"]));
  garder("invoice", stringOrNull(obj["invoice"]));
  garder("billing_reason", stringOrNull(obj["billing_reason"]));
  garder("collection_method", stringOrNull(obj["collection_method"]));
  garder("hosted_invoice_url", stringOrNull(obj["hosted_invoice_url"]));
  garder("number", stringOrNull(obj["number"]));
  garder("cancel_at_period_end", obj["cancel_at_period_end"] === true ? true : undefined);
  garder("current_period_end", numberOrNull(obj["current_period_end"]));
  garder("attempt_count", numberOrNull(obj["attempt_count"]));
  /* Le motif d'un refus : c'est LA question qu'on a passé une journée à poser
     à la banque le 05/08/2026, faute de l'avoir conservée. */
  const lastError = obj["last_payment_error"];
  if (lastError && typeof lastError === "object") {
    const e = lastError as Record<string, unknown>;
    garder("failure_code", stringOrNull(e["code"]));
    garder("failure_decline_code", stringOrNull(e["decline_code"]));
    garder("failure_message", stringOrNull(e["message"]));
  }

  const amount =
    numberOrNull(obj["amount_total"]) ??
    numberOrNull(obj["amount_paid"]) ??
    numberOrNull(obj["amount_due"]) ??
    numberOrNull(obj["amount"]);

  return {
    eventId: event.id,
    type: event.type,
    livemode: event.livemode,
    reference: referenceOf(obj),
    stripeObjectId: stringOrNull(obj["id"]),
    amountCents: amount,
    currency: stringOrNull(obj["currency"])?.toUpperCase() ?? null,
    payload,
  };
}

/**
 * Les faits d'une session de paiement aboutie, tels qu'ils doivent atteindre la
 * finalisation.
 *
 * On relit l'abonnement chez Stripe plutôt que de se contenter de la session :
 * `current_period_end` n'y figure pas, et c'est pourtant lui qui doit faire
 * autorité sur l'échéance. Recalculer la nôtre la ferait dériver de la sienne,
 * et c'est la nôtre qui s'afficherait au praticien.
 */
export async function factsFromCompletedSession(
  event: Stripe.Event,
): Promise<
  | {
      ok: true;
      reference: string;
      amountCents: number | null;
      currency: string | null;
      occurredAt: Date;
      stripe: {
        subscriptionId: string;
        customerId: string | null;
        currentPeriodEnd: Date;
      };
    }
  | { ok: false; reason: string }
> {
  const session = event.data.object as Stripe.Checkout.Session;

  const reference =
    session.client_reference_id ?? session.metadata?.reference ?? null;
  if (!reference) {
    return { ok: false, reason: "session sans référence MediCare Pro" };
  }

  /* Une session peut aboutir sans que le paiement soit acquis : virement en
     attente, prélèvement SEPA en cours de traitement. On ne crée un contrat que
     sur un paiement effectif. */
  if (session.payment_status !== "paid") {
    return {
      ok: false,
      reason: `paiement non acquis (payment_status = ${session.payment_status})`,
    };
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!subscriptionId) {
    return { ok: false, reason: "session sans abonnement rattaché" };
  }

  let currentPeriodEnd: Date;
  try {
    const sub = await stripe().subscriptions.retrieve(subscriptionId);
    /* `items.data[0].current_period_end` dans les versions récentes de l'API :
       l'échéance vit sur la ligne d'abonnement, pas sur l'abonnement lui-même. */
    const fin =
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      sub.items?.data?.[0]?.current_period_end;
    if (typeof fin !== "number") {
      return { ok: false, reason: "abonnement Stripe sans échéance lisible" };
    }
    currentPeriodEnd = new Date(fin * 1000);
  } catch (err) {
    return {
      ok: false,
      reason: `abonnement illisible : ${err instanceof Error ? err.message.slice(0, 120) : "?"}`,
    };
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  return {
    ok: true,
    reference,
    amountCents: session.amount_total ?? null,
    currency: session.currency?.toUpperCase() ?? null,
    occurredAt: new Date(event.created * 1000),
    stripe: { subscriptionId, customerId, currentPeriodEnd },
  };
}
