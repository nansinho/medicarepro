/* ============================================================
   Tarification — SOURCE UNIQUE des montants facturés.

   Formules (alignées sur le CMS pricing_plans / PRICING_PLANS) :
   - MONTHLY : 29,88 € TTC/mois + 15,00 € TTC/mois/collaborateur
   - ANNUAL  : 24,84 € TTC/mois (298,08 €/an) + 15,00 €/mois/collab,
               facturé EN UNE FOIS pour 12 mois.

   Le 1er paiement (carte Monetico) ET le renouvellement (SEPA)
   utilisent la même formule ; le renouvellement fige ensuite son
   montant dans subscriptions.renewal_amount_cents (snapshot).

   ⚠️ GEL PROD : l'exemple de la doc dev B (ANNUAL + 2 collab =
   23 904 cts) ne correspond PAS à ce barème (65 808 cts calculés).
   Ne pas ouvrir la vente avant confirmation écrite du mapping —
   si l'app valide payment.amount contre son barème, tous les
   provisionings partiraient en 400 après encaissement.
   ============================================================ */

/** Plans du contrat de provisioning dev B (casse exacte de l'API). */
export type BillingPlan = "MONTHLY" | "ANNUAL";

/**
 * Version de la grille tarifaire en vigueur — archivée dans la preuve
 * de consentement (consent_records). À incrémenter à CHAQUE changement
 * de barème (les montants exacts consentis sont par ailleurs figés
 * dans pending_signups.amount_cents / subscriptions.renewal_amount_cents).
 */
export const PRICING_VERSION = "tarifs-2026-07";

/** planKey CMS (pricing_plans / appLinks) → plan API dev B. */
export function planFromPlanKey(planKey: string): BillingPlan {
  return planKey === "monthly" ? "MONTHLY" : "ANNUAL";
}

/** Plan API dev B → planKey CMS. */
export function planKeyFromPlan(plan: BillingPlan): "monthly" | "annual" {
  return plan === "MONTHLY" ? "monthly" : "annual";
}

/** Base mensuelle TTC en centimes — plan sans engagement. */
export const BASE_MONTHLY_CENTS = 2988;
/** Base mensuelle TTC en centimes — offre 12 mois (facturée à l'année). */
export const BASE_ANNUAL_MONTHLY_CENTS = 2484;
/** Supplément mensuel TTC par collaborateur. */
export const COLLABORATOR_MONTHLY_CENTS = 1500;

/**
 * Plafond de collaborateurs supplémentaires.
 *
 * IL N'Y A PAS DE MAXIMUM COMMERCIAL : confirmé par le client le 05/08/2026, un
 * cabinet peut déclarer autant de collaborateurs qu'il en emploie. Le plafond
 * précédent, à 20, refusait donc une vente parfaitement légitime.
 *
 * Ce qui reste est un garde-fou de SAISIE, pas une limite d'offre. La valeur
 * arrive par une requête JSON : sans borne, un `99999` posté à la main
 * ouvrirait un abonnement à un million et demi d'euros par mois chez Stripe,
 * avec la facture qui va avec. Deux cents dépasse de très loin le plus grand
 * cabinet de podologie français, et se relève d'une ligne si le besoin apparaît.
 */
export const MAX_EXTRA_COLLABORATORS = 200;

function assertCollaborators(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > MAX_EXTRA_COLLABORATORS) {
    throw new Error(
      `Nombre de collaborateurs invalide (0 à ${MAX_EXTRA_COLLABORATORS}).`,
    );
  }
}

/** Mensualité TTC en centimes (avant périodicité de facturation). */
export function monthlyPriceCents(
  plan: BillingPlan,
  extraCollaborators: number,
): number {
  assertCollaborators(extraCollaborators);
  const base =
    plan === "MONTHLY" ? BASE_MONTHLY_CENTS : BASE_ANNUAL_MONTHLY_CENTS;
  return base + COLLABORATOR_MONTHLY_CENTS * extraCollaborators;
}

/**
 * Montant TTC facturé au checkout (et à chaque renouvellement) :
 * MONTHLY = un mois ; ANNUAL = douze mois en une fois.
 */
export function checkoutAmountCents(
  plan: BillingPlan,
  extraCollaborators: number,
): number {
  const monthly = monthlyPriceCents(plan, extraCollaborators);
  return plan === "MONTHLY" ? monthly : monthly * 12;
}

/** Montant du renouvellement — même formule que le 1er paiement. */
export const renewalAmountCents = checkoutAmountCents;

/* ============================================================
   PAIEMENT EN TROIS FOIS — offre 12 mois uniquement.

   Décidé le 06/08/2026 : trois versements sur trois mois consécutifs, sans
   frais. Le client a écarté le paiement en deux fois puis en quatre — trois
   mois d'affilée est son arbitrage entre l'effort demandé au praticien et le
   temps pendant lequel nous portons le risque.

   POURQUOI SEULEMENT L'ANNUEL. Le mensuel est déjà un étalement : le découper
   à nouveau produirait des versements de dix euros pour un coût de traitement
   identique. L'échelonnement n'existe que pour amortir les 298,08 € demandés
   d'un coup.

   LE DÉCOUPAGE DOIT TOMBER JUSTE. 29 808 / 3 = 9 936 exactement, mais ce n'est
   vrai que pour un titulaire seul : avec des collaborateurs, le total n'est pas
   toujours divisible par trois. Un arrondi naïf ferait payer un centime de trop
   ou de moins, et cet écart-là finit par se voir sur une facture. On met donc le
   reste sur le PREMIER versement — celui qui est encaissé tout de suite, sous
   les yeux du praticien, plutôt que sur un prélèvement qu'il découvrira seul.
   ============================================================ */

/** Nombre de versements de l'offre échelonnée. */
export const INSTALMENT_COUNT = 3;

/**
 * Les montants des versements, dans l'ordre, dont la somme vaut EXACTEMENT le
 * prix annuel. Le premier absorbe le reste de la division.
 */
export function instalmentAmountsCents(totalCents: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("Montant à échelonner invalide.");
  }
  const part = Math.floor(totalCents / INSTALMENT_COUNT);
  const reste = totalCents - part * INSTALMENT_COUNT;
  const parts = Array.from({ length: INSTALMENT_COUNT }, () => part);
  parts[0] += reste;
  return parts;
}

/** L'échelonnement n'est proposé que sur l'offre 12 mois. */
export function instalmentsAvailable(plan: BillingPlan): boolean {
  return plan === "ANNUAL";
}

/**
 * Libellé commercial de l'offre — utilisé sur les factures, les reçus et
 * les alertes internes. Source unique : premier paiement ET reconductions.
 */
export function planLabel(
  plan: BillingPlan,
  extraCollaborators: number,
): string {
  const base =
    plan === "ANNUAL" ? "Offre 12 mois" : "Offre mensuelle sans engagement";
  if (extraCollaborators === 0) return base;
  return `${base} + ${extraCollaborators} collaborateur${extraCollaborators > 1 ? "s" : ""}`;
}

/** "658,08 €" — affichage FR d'un montant en centimes. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
