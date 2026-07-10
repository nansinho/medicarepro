/**
 * Contenu de la page /fonctionnalites — extraction 1:1 de :
 * src/app/(site)/fonctionnalites/page.tsx + FeaturesHero.tsx.
 * Les 10 sections détaillées viennent de la collection feature_items
 * ("features") ; tones/backgrounds reprennent SHOWCASE_TONES/SHOWCASE_BG.
 * Conventions : `\n` = <br />, `**…**` = accent, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_FONCTIONNALITES = {
  slug: "/fonctionnalites",
  title: "Fonctionnalités",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Fonctionnalités",
        title: "Tout votre cabinet,\n**automatisé.**",
        lead: "Facturation, signature, comptabilité, agenda, bilans et application mobile.\nSix outils premium réunis, à partir de 24,84 €/mois.",
      },
    },
    {
      key: "showcase",
      type: "feature_showcase",
      content: {
        type: "feature_showcase",
        collection: "features",
        tones: [
          "white", // Facturation
          "soft", // Signature
          "medium", // Comptabilité
          "dark", // Agenda (vedette foncée)
          "white", // Bilans
          "soft", // PWA
          "medium", // Vitale
          "dark", // IA (vedette foncée)
          "white", // Portail
          "soft", // Stats
        ],
        backgrounds: [
          {
            index: 3,
            image: {
              mediaId: null,
              path: "/images/fonctionnalites/podologue-medicarepro-section-1.jpg",
              alt: "",
            },
          },
          {
            index: 7,
            image: {
              mediaId: null,
              path: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg",
              alt: "",
            },
          },
        ],
      },
    },
    {
      key: "stats",
      type: "stats_band",
      content: {
        type: "stats_band",
        kicker: "En chiffres",
        title: "Un seul outil, tout votre cabinet",
        stats: [
          {
            icon: "Grid",
            to: 10,
            suffix: "",
            label: "fonctionnalités majeures incluses",
          },
          {
            icon: "FileText",
            to: 13,
            suffix: "",
            label: "bilans podologiques inclus",
          },
          {
            icon: "Calculator",
            to: 260,
            prefix: "−",
            suffix: " €",
            label: "par mois vs outils séparés",
          },
          {
            icon: "Refresh",
            to: 100,
            suffix: " %",
            label: "automatique, sans ressaisie",
          },
        ],
      },
    },
    {
      key: "portal",
      type: "portal_cards",
      content: {
        type: "portal_cards",
        kicker: "Explorer en détail",
        title: "Tout ce que MediCare Pro vous apporte",
        linkLabel: "Découvrir",
        cards: [
          {
            icon: "FileText",
            title: "Bilans podologiques",
            text: "13 bilans normés avec scores calculés automatiquement : diabétique, risque de chute, posturologie et plus.",
            href: "/bilans",
          },
          {
            icon: "ShieldCheck",
            title: "Sécurité & conformité",
            text: "Hébergement HDS en France, conformité RGPD, chiffrement et sauvegardes quotidiennes de vos données patients.",
            href: "/securite",
          },
          {
            icon: "CheckCircle",
            title: "Les avantages",
            text: "Simplicité, tout-en-un, gain de temps : pourquoi les podologues choisissent MediCare Pro au quotidien.",
            href: "/avantages",
          },
        ],
      },
    },
    {
      key: "cta",
      type: "cta_panel",
      content: {
        type: "cta_panel",
        kicker: "Prêt à gagner du temps ?",
        title: "Tout votre cabinet, réuni dans une seule application",
        lead: "Facturation, bilans, agenda, comptabilité et signature électronique — à partir de 24,84 €/mois, tout inclus.",
        primary: { label: "Je m'abonne", href: "app:register:annual" },
        secondary: { label: "Demander une démo", href: "/contact" },
      },
    },
  ],
} satisfies ManagedPageContent;
