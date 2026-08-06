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
  /** L'ancien montant de reconduction, pour savoir si le changement coûte plus. */
  currentAmountCents: number;
  /** Le nouveau montant de reconduction. */
  nextAmountCents: number;
}): Promise<{
  currentPeriodEnd: Date | null;
  /** Renseigné quand une facture a été émise sur-le-champ. */
  invoice: { status: string; hostedUrl: string | null; amountCents: number } | null;
}> {
  const s = stripe();
  const actuel = await s.subscriptions.retrieve(input.subscriptionId);

  const remplacement: Stripe.SubscriptionUpdateParams.Item[] = [
    ...actuel.items.data.map((i) => ({ id: i.id, deleted: true as const })),
    ...itemsFor(input.plan, input.extraCollaborators),
  ];

  /* UNE AUGMENTATION SE PAIE TOUT DE SUITE.

     `create_prorations` calcule la différence et l'ajoute à la PROCHAINE
     facture. Sur un mensuel, le report est d'un mois au plus : c'est la norme.
     Sur une offre 12 MOIS, c'est une année entière de service livrée avant
     d'être payée — constaté le 06/08/2026 sur MPKZ0EVPW38B, où l'ajout de
     quatre collaborateurs a produit 719,99 € de prorata exigibles… en août
     2027.

     `always_invoice` émet la facture immédiatement et la prélève sur la carte
     enregistrée. Le montant reste calculé au prorata du temps restant depuis le
     début du contrat : le praticien ne paie que ce qu'il va réellement
     consommer.

     À LA BAISSE, on garde `create_prorations` : l'avoir se déduit de la
     prochaine facture, et il n'y a jamais de remboursement au prorata — c'est
     l'engagement écrit aux CGV, et `always_invoice` sur un crédit ouvrirait une
     facture négative que personne n'a demandée. */
  const augmentation = input.nextAmountCents > input.currentAmountCents;

  const misAJour = await s.subscriptions.update(input.subscriptionId, {
    items: remplacement,
    proration_behavior: augmentation ? "always_invoice" : "create_prorations",
    /* Une résiliation programmée n'a plus lieu d'être si le praticien change de
       formule : il reste. */
    cancel_at_period_end: false,
    metadata: { ...actuel.metadata },
    ...(augmentation ? { expand: ["latest_invoice"] } : {}),
  });

  const fin =
    (misAJour as unknown as { current_period_end?: number }).current_period_end ??
    misAJour.items?.data?.[0]?.current_period_end;

  /* La facture émise à l'instant. Si la carte exige une authentification, elle
     reste ouverte : son adresse hébergée est le SEUL moyen pour le praticien de
     finir le paiement, et sans elle il croirait avoir réglé. */
  let invoice: {
    status: string;
    hostedUrl: string | null;
    amountCents: number;
  } | null = null;
  const derniere = (misAJour as unknown as { latest_invoice?: unknown })
    .latest_invoice;
  if (augmentation && derniere && typeof derniere === "object") {
    const f = derniere as Stripe.Invoice;
    invoice = {
      status: f.status ?? "unknown",
      hostedUrl: f.hosted_invoice_url ?? null,
      amountCents: f.amount_due ?? f.total ?? 0,
    };
  }

  return {
    currentPeriodEnd: typeof fin === "number" ? new Date(fin * 1000) : null,
    invoice,
  };
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
      /* Pas de liste imposée : le tableau de bord Stripe décide. Une liste en
         dur fait refuser la session entière dès qu'un moyen n'est pas activé
         sur le compte. */
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

/**
 * Ce que coûtera un changement, AVANT de le valider.
 *
 * POURQUOI C'EST NÉCESSAIRE. Stripe proratise par défaut sans rien prélever sur
 * le moment : la différence s'ajoute à la prochaine facture. C'est le
 * comportement le moins brutal, mais il est invisible — le praticien valide un
 * changement et ne voit aucun mouvement, sans savoir ce qui l'attend. Il faut
 * donc le lui montrer d'abord.
 *
 * Rien n'est modifié ici : Stripe calcule la facture qu'il émettrait, on la lit,
 * et on la jette.
 */
export async function previewStripeChange(input: {
  subscriptionId: string;
  plan: BillingPlan;
  extraCollaborators: number;
}): Promise<{
  /* Ce qui s'ajoute (ou se déduit) au titre du temps déjà payé. */
  prorationCents: number;
  /* Le total de la prochaine facture, prorata compris. */
  nextInvoiceCents: number;
  nextInvoiceDate: Date | null;
}> {
  const s = stripe();
  const actuel = await s.subscriptions.retrieve(input.subscriptionId);

  const apercu = await s.invoices.createPreview({
    subscription: input.subscriptionId,
    subscription_details: {
      items: [
        ...actuel.items.data.map((i) => ({ id: i.id, deleted: true as const })),
        ...itemsFor(input.plan, input.extraCollaborators),
      ],
      proration_behavior: "create_prorations",
    },
  });

  let prorationCents = 0;
  for (const ligne of apercu.lines?.data ?? []) {
    const estProrata =
      (ligne as unknown as { proration?: boolean }).proration === true ||
      (ligne as unknown as {
        parent?: { subscription_item_details?: { proration?: boolean } };
      }).parent?.subscription_item_details?.proration === true;
    if (estProrata) prorationCents += ligne.amount ?? 0;
  }

  const fin =
    (apercu as unknown as { period_end?: number }).period_end ??
    (apercu as unknown as { next_payment_attempt?: number }).next_payment_attempt;

  return {
    prorationCents,
    nextInvoiceCents: apercu.total ?? 0,
    nextInvoiceDate: typeof fin === "number" ? new Date(fin * 1000) : null,
  };
}
