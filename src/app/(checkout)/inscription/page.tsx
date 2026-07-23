import type { Metadata } from "next";
import { hasBilling, billingEnv } from "@/lib/env";
import {
  planFromPlanKey,
  monthlyPriceCents,
  checkoutAmountCents,
  formatEuros,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import CheckoutFlow, {
  type PriceTable,
} from "@/components/checkout/CheckoutFlow";

/* ============================================================
   /inscription — point d'entrée du tunnel d'inscription payante.
   Server component : lit le plan demandé (?plan=monthly|annual),
   pré-calcule la table de prix (0 à 20 collaborateurs, 2 plans)
   et délègue tout l'interactif à <CheckoutFlow/> (client).
   ============================================================ */

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Créez votre espace MediCare Pro : choisissez votre formule, renseignez votre cabinet et payez en ligne de façon sécurisée.",
};

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Tunnel fermé : le layout affiche déjà l'écran d'indisponibilité.
  if (!hasBilling()) return null;

  const { checkoutPlans, sepaIcs, sepaEnabled } = billingEnv();
  /* Une formule n'est vendable que si un code site Monetico porte SA
     fréquence de reconduction (cf. CHECKOUT_PLANS dans lib/env). */
  const monthlyEnabled = checkoutPlans === "all" || checkoutPlans === "monthly";
  const annualEnabled = checkoutPlans === "all" || checkoutPlans === "annual";

  const sp = await searchParams;
  /* Sans plan explicite, on ouvre sur la formule vendable — les CTA du site
     pointent majoritairement vers ?plan=annual, qui doit rester atterrissable
     même quand l'annuel est fermé. */
  const planKey =
    typeof sp.plan === "string" ? sp.plan : annualEnabled ? "annual" : "monthly";
  let initialPlan = planFromPlanKey(planKey);
  if (initialPlan === "MONTHLY" && !monthlyEnabled) initialPlan = "ANNUAL";
  if (initialPlan === "ANNUAL" && !annualEnabled) initialPlan = "MONTHLY";

  /* Table de prix pré-calculée (source unique : lib/checkout/pricing) —
     le client n'embarque aucune logique tarifaire. */
  const prices: PriceTable = { MONTHLY: [], ANNUAL: [] };
  for (const plan of ["MONTHLY", "ANNUAL"] as BillingPlan[]) {
    for (let n = 0; n <= MAX_EXTRA_COLLABORATORS; n++) {
      prices[plan].push({
        monthlyLabel: formatEuros(monthlyPriceCents(plan, n)),
        totalLabel: formatEuros(checkoutAmountCents(plan, n)),
      });
    }
  }

  return (
    <CheckoutFlow
      initialPlan={initialPlan}
      monthlyEnabled={monthlyEnabled}
      annualEnabled={annualEnabled}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      sepaIcs={sepaIcs}
      sepaEnabled={sepaEnabled}
      prices={prices}
    />
  );
}
