import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/env";
import { siteUrl } from "@/lib/http/site-url";
import { MAX_EXTRA_COLLABORATORS, type BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   Agir sur un abonnement Stripe.

   CE QUE ÇA REMPLACE. Chez Monetico, changer de formule imposait d'arrêter la
   reconduction bancaire — irréversiblement — puis de faire repayer le praticien
   à l'échéance, parce qu'une commande récurrente ne se modifie pas. Toute la
   mécanique de « demande enregistrée, honorée au terme » vient de là, et rien
   d'autre. Stripe modifie un abonnement en place.

   Le gain le plus visible est ailleurs : annuler une résiliation redonne
   RÉELLEMENT la reconduction. Chez Monetico, l'arrêt était définitif, et trois
   emails devaient expliquer au client que revenir en arrière ne suffisait pas.

   CE QUI NE CHANGE PAS, parce que ce sont des engagements écrits au client :
   une résiliation prend effet au TERME de la période déjà réglée, jamais le
   jour même, et sans remboursement au prorata.
   ============================================================ */

/** Les postes d'abonnement correspondant à une formule et un effectif. */
function itemsFor(
  plan: BillingPlan,
  extraCollaborators: number,
): Array<{ price: string; quantity: number }> {
  if (!Number.isInteger(extraCollaborators) || extraCollaborators < 0) {
    throw new Error("Nombre de collaborateurs invalide.");
  }
  if (extraCollaborators > MAX_EXTRA_COLLABORATORS) {
    throw new Error(`Nombre de collaborateurs au-delà du maximum (${MAX_EXTRA_COLLABORATORS}).`);
  }

  const { prices } = stripeConfig();
  const annuel = plan === "ANNUAL";
  const base = annuel ? prices.annual : prices.monthly;
  const collab = annuel ? prices.collaboratorAnnual : prices.collaboratorMonthly;

  if (!base) throw new Error(`Aucun prix Stripe configuré pour la formule ${plan}.`);
  if (extraCollaborators > 0 && !collab) {
    /* Même règle qu'à la souscription : refuser plutôt que sous-facturer. Un
       cabinet paierait le tarif du titulaire seul, et personne ne le verrait
       avant la comptabilité. */
    throw new Error(
      `Prix collaborateur Stripe absent pour la formule ${plan} : changement refusé plutôt que sous-facturé.`,
    );
  }

  const items = [{ price: base, quantity: 1 }];
  if (extraCollaborators > 0 && collab) {
    items.push({ price: collab, quantity: extraCollaborators });
  }
  return items;
}

/**
 * Change la formule ou l'effectif, avec effet immédiat.
 *
 * `create_prorations` : Stripe déduit ce qui reste de la période déjà réglée et
 * ne facture que la différence. Rien n'est perdu, et le praticien a son nouveau
 * plan dans la seconde — ce que Monetico ne savait pas faire.
 *
 * On remplace TOUS les postes plutôt que d'ajuster les quantités : passer du
 * mensuel à l'annuel change le prix de base, et un poste oublié continuerait
 * d'être facturé à côté du nouveau.
 */
export async function changeStripePlan(input: {
  subscriptionId: string;
  plan: BillingPlan;
  extraCollaborators: number;
}): Promise<{ currentPeriodEnd: Date | null }> {
  const s = stripe();
  const actuel = await s.subscriptions.retrieve(input.subscriptionId);

  const remplacement: Stripe.SubscriptionUpdateParams.Item[] = [
    ...actuel.items.data.map((i) => ({ id: i.id, deleted: true as const })),
    ...itemsFor(input.plan, input.extraCollaborators),
  ];

  const misAJour = await s.subscriptions.update(input.subscriptionId, {
    items: remplacement,
    proration_behavior: "create_prorations",
    /* Une résiliation programmée n'a plus lieu d'être si le praticien change de
       formule : il reste. */
    cancel_at_period_end: false,
    metadata: { ...actuel.metadata },
  });

  const fin =
    (misAJour as unknown as { current_period_end?: number }).current_period_end ??
    misAJour.items?.data?.[0]?.current_period_end;
  return { currentPeriodEnd: typeof fin === "number" ? new Date(fin * 1000) : null };
}

/**
 * Programme la fin au terme, ou l'annule.
 *
 * Jamais de résiliation immédiate : l'accès est dû jusqu'à la période payée,
 * c'est un engagement pris au client et il ne dépend pas du prestataire.
 */
export async function setStripeCancelAtPeriodEnd(
  subscriptionId: string,
  cancel: boolean,
): Promise<{ currentPeriodEnd: Date | null }> {
  const misAJour = await stripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancel,
  });
  const fin =
    (misAJour as unknown as { current_period_end?: number }).current_period_end ??
    misAJour.items?.data?.[0]?.current_period_end;
  return { currentPeriodEnd: typeof fin === "number" ? new Date(fin * 1000) : null };
}

/**
 * Ouvre une page pour enregistrer une nouvelle carte.
 *
 * Mode `setup` : aucun montant n'est débité, on ne fait qu'enregistrer un moyen
 * de paiement. Chez Monetico, changer de carte imposait de repayer une échéance
 * entière — le praticien payait pour corriger un numéro de carte.
 *
 * Le rattachement de la carte à l'abonnement se fait à réception de
 * `checkout.session.completed`, quand Stripe a validé l'authentification.
 */
export async function startStripeCardUpdate(input: {
  customerId: string;
  subscriptionId: string;
  reference: string;
}): Promise<{ url: string; sessionId: string }> {
  const session = await stripe().checkout.sessions.create(
    {
      mode: "setup",
      customer: input.customerId,
      currency: "eur",
      payment_method_types: ["card", "sepa_debit"],
      locale: "fr",
      client_reference_id: input.reference,
      metadata: {
        reference: input.reference,
        kind: "card_update",
        subscription: input.subscriptionId,
      },
      success_url: `${siteUrl("/mon-abonnement/merci")}?ref=${encodeURIComponent(input.reference)}`,
      cancel_url: `${siteUrl("/mon-abonnement/echec")}?ref=${encodeURIComponent(input.reference)}`,
    },
    { idempotencyKey: `card-update:${input.reference}` },
  );
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'adresse.");
  return { url: session.url, sessionId: session.id };
}

/**
 * Rattache la carte enregistrée à l'abonnement, et la rend celle par défaut.
 *
 * Sans ce second temps, la carte existerait chez Stripe sans jamais servir : la
 * prochaine échéance repartirait sur l'ancienne, et le praticien croirait avoir
 * changé de moyen de paiement.
 */
export async function attachStripePaymentMethod(input: {
  setupIntentId: string;
  subscriptionId: string;
}): Promise<void> {
  const s = stripe();
  const intent = await s.setupIntents.retrieve(input.setupIntentId);
  const moyen =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : (intent.payment_method?.id ?? null);
  if (!moyen) throw new Error("Aucun moyen de paiement enregistré.");

  await s.subscriptions.update(input.subscriptionId, {
    default_payment_method: moyen,
  });
}
