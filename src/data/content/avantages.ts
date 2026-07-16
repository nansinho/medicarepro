/**
 * Contenu de la page /avantages — extraction 1:1 de :
 * src/app/(site)/avantages/page.tsx + AvantagesHero.tsx + SavingsCompare.tsx.
 * Conventions : `\n` = <br />, `**…**` = accent, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_AVANTAGES = {
  slug: "/avantages",
  title: "Avantages",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Avantages",
        title: "Un seul logiciel, **tout votre cabinet simplifié.**",
        lead: "Tout-en-un, simple, rapide et économique : voici pourquoi les podologues choisissent MediCare Pro pour gérer leur cabinet au quotidien, à partir de 24,84 €/mois, tout inclus.",
        trust: [
          { icon: "Layers", label: "Tout-en-un" },
          { icon: "Sparkles", label: "Simple à prendre en main" },
          { icon: "Clock", label: "Gain de temps" },
          { icon: "Wallet", label: "Jusqu'à 260 €/mois économisés" },
        ],
      },
    },
    {
      key: "showcase_1",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Layers",
        kicker: "Tout-en-un",
        title: "Tout votre cabinet dans une seule application",
        text: "Fini les outils dispersés et les abonnements multiples. Patients, factures, comptabilité, agenda, bilans et signature : tout est réuni au même endroit, sans ressaisie.",
        points: [
          "Patients, factures, compta et agenda centralisés",
          "Aucune double saisie d'un outil à l'autre",
          "Une seule facture mensuelle, un seul interlocuteur",
          "10 fonctionnalités majeures incluses",
        ],
        mockup: "pwa",
        tone: "white",
        reverse: false,
      },
    },
    {
      key: "showcase_2",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Sparkles",
        kicker: "Simplicité",
        title: "Une prise en main immédiate, sans formation",
        text: "Une interface claire, pensée pour les podologues et non pour les informaticiens. Vous êtes opérationnel dès le premier jour, sans manuel ni formation coûteuse.",
        points: [
          "Interface intuitive et épurée",
          "Opérationnel dès le premier jour",
          "Aucune formation requise",
          "Support humain réactif si besoin",
        ],
        mockup: "agenda",
        tone: "soft",
        reverse: true,
      },
    },
    {
      key: "showcase_3",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Zap",
        kicker: "Gain de temps",
        title: "Des heures gagnées chaque semaine",
        text: "L'administratif tourne tout seul : factures générées automatiquement, scores de bilans calculés, rappels de rendez-vous envoyés. Vous vous concentrez sur vos patients.",
        points: [
          "Facturation générée 100 % automatiquement",
          "Scores et grades de bilans calculés",
          "Rappels de rendez-vous par email et SMS",
          "Beaucoup moins d'administratif au quotidien",
        ],
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-2.jpg",
          alt: "Podologue qui gagne du temps grâce à l'automatisation",
        },
        tone: "dark",
        reverse: false,
      },
    },
    {
      key: "showcase_4",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "FileText",
        kicker: "Cliniquement complet",
        title: "Les bilans les plus complets du marché",
        text: "13 bilans podologiques normés, du pied diabétique au risque de chute en passant par la posturologie, avec scores et grades calculés automatiquement pour un suivi fiable.",
        points: [
          "13 bilans podologiques inclus",
          "Scores et grades calculés automatiquement",
          "Grilles cliniques validées",
          "Suivi comparatif dans le temps",
        ],
        mockup: "bilan",
        tone: "white",
        reverse: true,
      },
    },
    {
      key: "showcase_5",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "ShieldCheck",
        kicker: "Confiance",
        title: "Vos données protégées au plus haut niveau",
        text: "Hébergement HDS en France chez OVHcloud, conformité RGPD, chiffrement de bout en bout et sauvegardes incluses : la sécurité de vos patients est garantie, sans surcoût.",
        points: [
          "Hébergement HDS en France",
          "Conformité RGPD",
          "Chiffrement de bout en bout",
          "Sauvegardes quotidiennes incluses",
        ],
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section1.jpg",
          alt: "Infrastructure sécurisée hébergeant les données MediCare Pro",
        },
        tone: "dark",
        reverse: false,
      },
    },
    {
      key: "savings",
      type: "savings_compare",
      content: {
        type: "savings_compare",
        kicker: "Économies réalisées",
        title: "Un seul abonnement, pas cinq factures",
        lead: "Un podologue dépense en moyenne 285 €/mois en outils séparés. MediCare Pro centralise tout à partir de 24,84 €/mois.",
        before: {
          label: "Sans MediCare Pro",
          price: 285,
          priceNote: "/mois",
          totalLabel: "Total mensuel",
          tools: [
            {
              icon: "Calendar",
              label: "Agenda & prise de RDV en ligne",
              price: "150 €",
            },
            { icon: "Invoice", label: "Logiciel de facturation", price: "40 €" },
            {
              icon: "Calculator",
              label: "Expert-comptable / comptabilité",
              price: "60 €",
            },
            {
              icon: "Signature",
              label: "Signature électronique",
              price: "20 €",
            },
            { icon: "Server", label: "Sauvegarde sécurisée", price: "15 €" },
          ],
        },
        after: {
          label: "MediCare Pro",
          price: 24.84,
          priceNote: "/mois",
          badge: "Tout inclus",
          points: [
            "Agenda et prise de RDV inclus",
            "Comptabilité intégrée",
            "Sans aucune option cachée",
          ],
        },
        stats: [
          {
            icon: "TrendingUp",
            to: 260,
            prefix: "−",
            suffix: " €",
            label: "économisés par mois",
          },
          {
            icon: "Wallet",
            to: 3120,
            suffix: " €",
            label: "économisés par an, en moyenne",
          },
        ],
        tone: "soft",
      },
    },
    {
      key: "reviews",
      type: "reviews",
      content: {
        type: "reviews",
        kicker: "Avis de podologues",
        title: "Ils nous font confiance",
        tone: "white",
        rating: {
          value: "4,9/5",
          label: "note moyenne · podologues abonnés",
        },
      },
    },
    {
      key: "stats",
      type: "stats_band",
      content: {
        type: "stats_band",
        kicker: "En chiffres",
        title: "Le tout-en-un qui change la donne",
        stats: [
          {
            icon: "TrendingUp",
            to: 260,
            prefix: "−",
            suffix: " €",
            label: "économisés par mois en moyenne",
          },
          {
            icon: "Layers",
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
            icon: "Wallet",
            to: 3120,
            suffix: " €",
            label: "économisés par an, en moyenne",
          },
        ],
      },
    },
    {
      key: "portal",
      type: "portal_cards",
      content: {
        type: "portal_cards",
        kicker: "Aller plus loin",
        title: "Explorer MediCare Pro",
        linkLabel: "Découvrir",
        cards: [
          {
            icon: "Layers",
            title: "Toutes les fonctionnalités",
            text: "Facturation, signature, comptabilité, agenda, bilans et application mobile : le détail de tout ce qui est inclus.",
            href: "/fonctionnalites",
            stat: "10 fonctionnalités",
          },
          {
            icon: "Calculator",
            title: "Tarifs tout inclus",
            text: "Un seul abonnement à 24,84 €/mois, sans option cachée. Comparez et calculez vos économies.",
            href: "/tarifs",
            stat: "24,84 €/mois",
          },
          {
            icon: "FileText",
            title: "Les 13 bilans podologiques",
            text: "Le catalogue de bilans le plus complet du marché, avec scores calculés automatiquement.",
            href: "/bilans",
            stat: "13 bilans",
          },
        ],
      },
    },
    {
      key: "cta",
      type: "cta_panel",
      content: {
        type: "cta_panel",
        kicker: "Prêt à simplifier votre cabinet ?",
        title: "Tout votre cabinet réuni, pour 24,84 €/mois",
        lead: "Tout-en-un, sans option cachée, et plus de 3 000 € économisés par an en moyenne face aux outils séparés.",
        primary: { label: "Je m'abonne", href: "app:register:annual" },
        secondary: { label: "Demander une démo", href: "/contact" },
        trust: [
          { icon: "ShieldCheck", label: "Hébergé en France (HDS)" },
          { icon: "Wallet", label: "Sans engagement" },
          { icon: "Clock", label: "Opérationnel en 1 jour" },
        ],
      },
    },
  ],
} satisfies ManagedPageContent;
