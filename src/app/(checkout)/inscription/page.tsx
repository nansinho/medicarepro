import type { Metadata } from "next";
import { canCollectPayment, paymentProvider, billingEnv } from "@/lib/env";
import {
  planFromPlanKey,
  monthlyPriceCents,
  checkoutAmountCents,
  formatEuros,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import Link from "next/link";
import CheckoutFlow, {
  type GiftOffer,
  type PriceTable,
} from "@/components/checkout/CheckoutFlow";
import { serviceClient } from "@/lib/supabase/service";
import {
  addGiftMonths,
  lookupGiftInvitation,
  GIFT_LOOKUP_MESSAGES,
} from "@/lib/billing/gift";
import s from "@/components/checkout/Checkout.module.css";

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
  if (!canCollectPayment()) return null;

  const { checkoutPlans, sepaIcs, sepaEnabled } = billingEnv();
  /* Chez Monetico, une formule n'était vendable que si un code site portait SA
     fréquence de reconduction — un TPE par périodicité, d'où CHECKOUT_PLANS.
     Stripe n'a pas cette contrainte : un même compte vend les deux, et la
     disponibilité ne dépend plus que de l'existence du prix au catalogue,
     déjà exigée par missingStripeEnv(). */
  const parStripe = paymentProvider() === "stripe";
  const monthlyEnabled =
    parStripe || checkoutPlans === "all" || checkoutPlans === "monthly";
  const annualEnabled =
    parStripe || checkoutPlans === "all" || checkoutPlans === "annual";

  const sp = await searchParams;
  /* Sans plan explicite, on ouvre sur la formule vendable — les CTA du site
     pointent majoritairement vers ?plan=annual, qui doit rester atterrissable
     même quand l'annuel est fermé. */
  const planKey =
    typeof sp.plan === "string" ? sp.plan : annualEnabled ? "annual" : "monthly";
  let initialPlan = planFromPlanKey(planKey);
  if (initialPlan === "MONTHLY" && !monthlyEnabled) initialPlan = "ANNUAL";
  if (initialPlan === "ANNUAL" && !annualEnabled) initialPlan = "MONTHLY";

  /* ACCÈS OFFERT. L'invitation est lue ICI, côté serveur : le navigateur ne
     reçoit que ce qu'il doit afficher, et un lien qui ne mène plus nulle part
     affiche pourquoi, au lieu d'ouvrir le tunnel payant à quelqu'un qui
     s'attendait à un cadeau. */
  let gift: GiftOffer | undefined;
  if (typeof sp.invitation === "string") {
    const supabase = serviceClient();
    const lookup = supabase
      ? await lookupGiftInvitation(supabase, sp.invitation)
      : ({ ok: false, reason: "unknown" } as const);
    if (!lookup.ok) {
      const message = GIFT_LOOKUP_MESSAGES[lookup.reason];
      return (
        <div className={s.shell}>
          <div className={s.centerCard}>
            <h1 className={s.centerTitle}>{message.title}</h1>
            <p className={s.centerText}>{message.text}</p>
            <p className={s.centerText}>
              <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
            </p>
            <Link href="/" className={s.btnGhost}>
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      );
    }
    const { invitation } = lookup;
    gift = {
      token: sp.invitation,
      email: invitation.email,
      months: invitation.months,
      requireCard: invitation.require_card,
      /* Indicatif : la date exacte est fixée à l'ouverture de la caisse, les
         mois courant à partir de l'inscription. */
      endsAtLabel: addGiftMonths(new Date(), invitation.months).toLocaleDateString(
        "fr-FR",
        { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" },
      ),
    };
    /* Le mensuel d'abord : après une période offerte, c'est la formule qui
       engage le moins. L'offre 12 mois reste proposée. */
    if (monthlyEnabled && typeof sp.plan !== "string") initialPlan = "MONTHLY";
  }

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
      /* Ce que le tunnel PROMET dépend de qui encaisse, et ce sont des
         engagements contractuels affichés juste avant le paiement. Chez
         Monetico, l'offre 12 mois passait par le TPE immédiat : un paiement
         unique, sans reconduction. Chez Stripe elle se reconduit comme le
         mensuel. Le navigateur ne peut pas le deviner, on le lui dit. */
      annualRenews={parStripe}
      payBrand={parStripe ? "Stripe" : "Monetico — CIC"}
      selfServiceCancel={parStripe}
      gift={parStripe ? gift : undefined}
    />
  );
}
