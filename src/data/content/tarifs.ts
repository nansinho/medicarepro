/**
 * Contenu de la page /tarifs — extraction 1:1 de :
 * src/app/(site)/tarifs/page.tsx + PricingPage.tsx.
 * Les cartes tarifaires = collection pricing_plans, le tableau d'exemples =
 * collection pricing_examples, la FAQ = collection faq_items.
 * Conventions : `\n` = <br />, `**…**` = accent/gras, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_TARIFS = {
  slug: "/tarifs",
  title: "Tarifs",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Tarifs",
        title: "Un prix unique, tout compris, sans surprise",
        lead: "Pas d'option payante, pas de module en supplément : un logiciel de podologie complet, toutes fonctionnalités incluses, à partir de 24,84 €/mois.",
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg",
          alt: "",
        },
      },
    },
    {
      key: "pricing",
      type: "pricing",
      content: {
        type: "pricing",
        title: "Une offre unique, **tout inclus**",
        subtitle:
          "Pas d'options payantes, pas de modules en supplément. Toutes les fonctionnalités sont incluses.",
        examplesTitle: "Exemples de tarification",
        tableHead: {
          config: "Configuration",
          monthly: "Mensuel",
          yearly: "Annuel",
        },
        navLinks: [
          { label: "← Sécurité", href: "/securite" },
          { label: "Les avantages →", href: "/avantages" },
          { label: "Toutes les fonctionnalités →", href: "/fonctionnalites" },
        ],
        ctaBand: {
          title: "Arrêtez de payer 285 €/mois pour 24,84 €",
          text: "Tout inclus. Économisez plus de 3 000 € par an.",
          cta: { label: "Je m'abonne", href: "app:register:annual" },
          note: "Offre 12 mois · 24,84 €/mois TTC",
        },
      },
    },
    {
      key: "savings",
      type: "savings_compare",
      content: {
        type: "savings_compare",
        kicker: "Économies réalisées",
        title: "Combien coûte un logiciel de podologie ?",
        lead: "Un podologue dépense en moyenne 285 €/mois en outils séparés. MediCare Pro centralise tout à partir de 24,84 €/mois.",
        before: {
          label: "Outils séparés",
          price: 285,
          priceNote: "/mois",
        },
        after: {
          label: "MediCare Pro, tout inclus",
          price: 24.84,
          priceNote: "/mois",
        },
        result: "Soit **+3 000 € économisés par an**, en moyenne.",
        stats: [
          { value: "−260 €", label: "par mois face aux outils séparés" },
          { value: "−17 %", label: "sur l'offre 12 mois (60,48 €/an)" },
          { value: "0 €", label: "d'option cachée — tout est inclus" },
        ],
      },
    },
    {
      key: "faq",
      type: "faq",
      content: {
        type: "faq",
        kicker: "Questions fréquentes",
        title: "Vous vous demandez…",
      },
    },
  ],
} satisfies ManagedPageContent;
