/**
 * Collections réutilisables (futures tables `testimonials`, `pricing_plans`,
 * `pricing_examples`, `feature_items`, `faq_items`) — extraction 1:1 du
 * contenu codé en dur, typée contre les schémas zod du registre CMS.
 *
 * FEATURE_ITEMS n'est PAS dupliqué : il re-forme FEATURES_DETAIL/BILANS_DETAIL
 * (sources de vérité actuelles) vers la forme collection du CMS.
 */
import type {
  FaqItem,
  FeatureItem,
  PricingExample,
  PricingPlan,
  Testimonial,
} from "@/lib/cms/sections.schema";
import { FEATURES_DETAIL } from "@/data/features";
import { BILANS_DETAIL } from "@/data/bilans";

export { FAQ_ITEMS } from "@/data/faq";

/* ------------------------------------------------------------------ */
/* Témoignages (PEOPLE de src/components/Reviews.tsx)                   */
/* ------------------------------------------------------------------ */

/* Avis clients : aucun avis réel pour l'instant (les témoignages fictifs ont
   été retirés). La section affiche un état « Bientôt les avis » tant que ce
   tableau et la table `testimonials` sont vides. */
export const TESTIMONIALS: Testimonial[] = [];

/** Preuve sociale affichée dans le bandeau des avis (note moyenne). */
export const TESTIMONIALS_RATING = {
  value: "4,9/5",
  label: "note moyenne · podologues abonnés",
};

/* ------------------------------------------------------------------ */
/* Tarifs (PLANS + EXAMPLES de src/components/PricingPage.tsx)          */
/* ------------------------------------------------------------------ */

export const PRICING_PLANS = [
  {
    planKey: "monthly",
    name: "Sans engagement",
    sub: "Liberté totale",
    price: 29.88,
    unit: "TTC/mois",
    secondary: "soit 24,90 € HT/mois",
    features: [
      { label: "Toutes les fonctionnalités incluses" },
      { label: "1 praticien titulaire inclus" },
      { label: "Résiliable à tout moment (préavis 15 jours)" },
      { label: "Service secrétariat inclus (gratuit)" },
      { label: "+15,00 € TTC/mois par collaborateur" },
      { label: "Mises à jour incluses" },
    ],
    cta: "Choisir cette offre",
  },
  {
    planKey: "annual",
    name: "Offre 12 mois",
    sub: "Engagement 12 mois ferme",
    price: 24.84,
    unit: "TTC/mois",
    secondary: "soit 20,70 € HT/mois, ou 298,08 € TTC/an",
    featured: true,
    badge: "−17 % recommandé",
    features: [
      { label: "Toutes les fonctionnalités incluses" },
      { label: "1 praticien titulaire inclus" },
      { label: "Économisez 60,48 €/an", highlight: true },
      { label: "Service secrétariat inclus (gratuit)" },
      { label: "+15,00 € TTC/mois par collaborateur" },
      { label: "Mises à jour incluses" },
    ],
    cta: "Choisir cette offre",
  },
] satisfies PricingPlan[];

export const PRICING_EXAMPLES = [
  { config: "1 praticien", monthly: 29.88, yearly: 24.84 },
  { config: "1 prat. + 1 collaborateur", monthly: 44.88, yearly: 39.84 },
  { config: "1 prat. + 2 collaborateurs", monthly: 59.88, yearly: 54.84 },
] satisfies PricingExample[];

/* ------------------------------------------------------------------ */
/* Fonctionnalités (re-shape des sources existantes, sans duplication)  */
/* ------------------------------------------------------------------ */

export const FEATURE_ITEMS = [
  ...FEATURES_DETAIL.map((feature, i) => ({
    collection: "features" as const,
    position: i,
    ...feature,
  })),
  ...BILANS_DETAIL.map((bilan, i) => ({
    collection: "bilans" as const,
    position: i,
    ...bilan,
  })),
] satisfies FeatureItem[];
