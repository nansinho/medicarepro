import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/env";
import { siteUrl } from "@/lib/http/site-url";
import { MAX_EXTRA_COLLABORATORS, type BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   Ouverture d'une session de paiement Stripe.

   LE MONTANT NE VIENT PAS D'ICI. On envoie des identifiants de prix, et Stripe
   applique ceux de son catalogue. Le navigateur ne peut donc rien influencer,
   et nous non plus : notre grille tarifaire ne sert plus qu'à afficher. C'est
   une garantie que le formulaire Monetico n'offrait pas, où le montant partait
   dans le champ `montant` et n'était protégé que par le sceau.

   NOTRE RÉFÉRENCE RESTE LA CLÉ. Le « MP + 10 caractères » produit par
   newOrderReference devient le `client_reference_id` de la session ET une
   métadonnée de l'abonnement. Toute la chaîne existante s'y adosse : clé
   d'idempotence du provisioning, AAD de chiffrement des mots de passe, clé du
   journal comptable, ligne « référence de paiement » imprimée sur la facture.

   La poser AUSSI sur l'abonnement n'est pas une redondance. `client_reference_id`
   ne vit que sur la session : les `invoice.paid` des mois suivants ne le
   porteraient pas, et une reconduction arriverait sans qu'on sache à quel
   contrat la rattacher.
   ============================================================ */

export type CheckoutInput = {
  /** Notre référence « MP + 10 ». Devient client_reference_id ET métadonnée. */
  reference: string;
  plan: BillingPlan;
  extraCollaborators: number;
  /**
   * Client Stripe déjà porteur de l'adresse de facturation complète.
   *
   * Préféré à `customerEmail` : une session ouverte avec la seule adresse
   * électronique produit une facture où le destinataire se réduit à un nom et
   * un pays. L'adresse du destinataire est une mention obligatoire.
   */
  customerId?: string;
  /** Repli quand aucun client Stripe n'a pu être créé. */
  customerEmail?: string;
  /** Chemin de retour après acceptation, ex. « /mon-abonnement/merci ». */
  successPath: string;
  /** Chemin de retour après abandon ou refus. JAMAIS le même que le succès. */
  errorPath: string;
  /** Métadonnées supplémentaires, reprises sur la session et l'abonnement. */
  metadata?: Record<string, string>;
};

/**
 * Construit les paramètres de la session, sans appeler Stripe.
 *
 * Séparé de l'appel pour être vérifiable : c'est ici que se jouent le choix des
 * prix, la quantité de collaborateurs et les adresses de retour, c'est-à-dire
 * tout ce qui peut faire payer le mauvais montant ou renvoyer un client refusé
 * sur un écran de remerciement.
 */
export function buildCheckoutParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(input.extraCollaborators) || input.extraCollaborators < 0) {
    throw new Error("Nombre de collaborateurs invalide.");
  }
  if (input.extraCollaborators > MAX_EXTRA_COLLABORATORS) {
    throw new Error(
      `Nombre de collaborateurs au-delà du maximum (${MAX_EXTRA_COLLABORATORS}).`,
    );
  }
  if (!input.customerId && !input.customerEmail) {
    throw new Error("Ni client Stripe ni adresse électronique : session refusée.");
  }
  if (input.successPath === input.errorPath) {
    /* Monetico l'a laissé passer sur les quatre points d'entrée : une carte
       refusée renvoyait sur « merci ». */
    throw new Error("Les chemins de retour accepté et refusé doivent différer.");
  }

  const prices = stripeConfig().prices;
  const annuel = input.plan === "ANNUAL";
  const basePrice = annuel ? prices.annual : prices.monthly;
  const collabPrice = annuel ? prices.collaboratorAnnual : prices.collaboratorMonthly;

  if (!basePrice) {
    throw new Error(`Aucun prix Stripe configuré pour la formule ${input.plan}.`);
  }
  if (input.extraCollaborators > 0 && !collabPrice) {
    /* Sans ce refus, la souscription partirait au tarif du titulaire seul et le
       cabinet paierait moins que ce qu'il a lu à l'écran. */
    throw new Error(
      `Prix collaborateur Stripe absent pour la formule ${input.plan} : souscription refusée plutôt que sous-facturée.`,
    );
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: basePrice, quantity: 1 },
  ];
  if (input.extraCollaborators > 0 && collabPrice) {
    lineItems.push({ price: collabPrice, quantity: input.extraCollaborators });
  }

  const metadata = { ...input.metadata, reference: input.reference };

  return {
    mode: "subscription",
    line_items: lineItems,
    /* Carte ET prélèvement SEPA. Le mandat est porté par Stripe : plus d'ICS à
       obtenir de la banque, plus de RUM à générer, plus de texte de mandat à
       archiver nous-mêmes. */
    payment_method_types: ["card", "sepa_debit"],
    locale: "fr",
    client_reference_id: input.reference,
    /* L'un OU l'autre : Stripe refuse les deux ensemble. */
    ...(input.customerId
      ? {
          customer: input.customerId,
          /* Autorise Stripe à mettre à jour l'adresse si le client la corrige
             sur la page de paiement, plutôt que de la figer à notre copie. */
          customer_update: { address: "auto" as const, name: "auto" as const },
        }
      : { customer_email: input.customerEmail }),
    metadata,
    subscription_data: { metadata },
    /* Calculées par siteUrl(), JAMAIS depuis la requête : en production le
       serveur standalone dérive « https://0.0.0.0:3000 » de HOSTNAME et PORT,
       et un client payé serait renvoyé sur une adresse injoignable. */
    success_url: `${siteUrl(input.successPath)}?ref=${encodeURIComponent(input.reference)}`,
    cancel_url: `${siteUrl(input.errorPath)}?ref=${encodeURIComponent(input.reference)}`,
  };
}

/**
 * Ouvre la session et rend l'adresse où envoyer le client.
 *
 * L'idempotence porte sur NOTRE référence : un double clic, ou une reprise
 * réseau, rouvre la même session au lieu d'en créer une seconde. Deux sessions
 * pour une commande, c'est un client qui peut payer deux fois.
 */
export async function createSubscriptionCheckout(
  input: CheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const session = await stripe().checkout.sessions.create(
    buildCheckoutParams(input),
    { idempotencyKey: `checkout:${input.reference}` },
  );
  if (!session.url) {
    throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.");
  }
  return { url: session.url, sessionId: session.id };
}
