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

export const MAX_EXTRA_COLLABORATORS = 20;

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

/** "658,08 €" — affichage FR d'un montant en centimes. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
