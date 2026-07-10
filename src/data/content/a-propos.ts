/**
 * Contenu de la page /a-propos — extraction 1:1 de :
 * src/app/(site)/a-propos/page.tsx (+ Values de Sections.tsx, CtaBand de
 * Sections2.tsx, Reviews.tsx).
 * Conventions : `\n` = <br />, `**…**` = <strong>/accent, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_A_PROPOS = {
  slug: "/a-propos",
  title: "À propos",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "À propos",
        title: "Conçu par des podologues, pour des podologues",
        lead: "Notre mission : réunir tout ce dont un cabinet de podologie a besoin dans une seule application, simple et conforme.",
        image: {
          mediaId: null,
          path: "/images/bilans-cabinet.jpg",
          alt: "",
        },
        imagePos: "center 45%",
      },
    },
    {
      key: "story",
      type: "story",
      content: {
        type: "story",
        kicker: "Notre histoire",
        title: "Né dans un cabinet, pas dans un open space.",
        paragraphs: [
          "MediCare Pro est parti d'un constat simple : un podologue jongle en moyenne avec **quatre logiciels** — patients, agenda, facturation, comptabilité — pour près de **285 € par mois**. Des outils qui ne se parlent pas, et des heures d'administratif qui s'accumulent le soir.",
          "Nous avons donc construit l'outil que nous aurions voulu trouver : **une seule application**, du dossier patient à la comptabilité, pensée pour les journées réelles d'un cabinet — pas pour une plaquette commerciale.",
          "Chaque fonctionnalité est née d'une demande de praticien ; c'est encore comme ça que MediCare Pro évolue aujourd'hui.",
        ],
        signature: "L'équipe MediCare Pro",
      },
    },
    {
      key: "timeline",
      type: "timeline",
      content: {
        type: "timeline",
        steps: [
          {
            title: "Le constat",
            text: "Quatre logiciels, près de 285 € par mois, et des soirées entières perdues en paperasse : la gestion du cabinet grignote le temps de soin.",
          },
          {
            title: "Le déclic",
            text: "Plutôt que d'empiler un outil de plus, tout réunir dans une seule application pensée pour les journées réelles d'un podologue.",
          },
          {
            title: "Le produit",
            text: "Dossiers patients, 13 bilans normés, facturation, agenda et comptabilité prennent forme — testés en cabinet, pas en salle de réunion.",
          },
          {
            title: "Aujourd'hui",
            text: "Une communauté de podologues qui fait évoluer l'outil en continu, une fonctionnalité à la fois.",
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
        title: "MediCare Pro aujourd'hui",
        stats: [
          {
            icon: "FileText",
            to: 13,
            suffix: "",
            decimals: 0,
            label: "bilans podologiques normés, scores calculés automatiquement",
          },
          {
            icon: "Wallet",
            to: 3120,
            suffix: " €",
            decimals: 0,
            label: "économisés par an en moyenne face aux outils séparés",
          },
          {
            icon: "ShieldCheck",
            to: 100,
            suffix: " %",
            decimals: 0,
            label: "des données hébergées en France, certifié HDS",
          },
          {
            icon: "Invoice",
            to: 24.84,
            suffix: " €",
            decimals: 2,
            label: "par mois tout compris, sans option cachée",
          },
        ],
      },
    },
    {
      key: "values",
      type: "values",
      content: {
        type: "values",
        kicker: "Nos engagements",
        title: "Pensé pour votre quotidien",
        items: [
          {
            icon: "CheckCircle",
            title: "Simplicité",
            text: "Une prise en main immédiate, sans formation.",
          },
          {
            icon: "Grid",
            title: "Tout-en-un",
            text: "Patients, factures, compta, agenda : un seul outil.",
          },
          {
            icon: "ShieldCheck",
            title: "Conformité",
            text: "RGPD et données de santé hébergées en HDS.",
          },
          {
            icon: "Lock",
            title: "Sécurité",
            text: "Chiffrement complet, authentification forte.",
          },
          {
            icon: "Clock",
            title: "Gain de temps",
            text: "Facturation et bilans automatisés.",
          },
        ],
        teaserHref: "/avantages",
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
      key: "cross_links",
      type: "cross_links",
      content: {
        type: "cross_links",
        links: [
          { label: "Les avantages", href: "/avantages" },
          { label: "Sécurité des données", href: "/securite" },
          { label: "Les bilans podologiques", href: "/bilans" },
        ],
      },
    },
    {
      key: "cta_band",
      type: "cta_band",
      content: {
        type: "cta_band",
        title: "Ne laissez plus l'administratif vous freiner",
        text: "Abonnez-vous dès aujourd'hui et centralisez tout votre cabinet.",
        cta: { label: "Je m'abonne", href: "app:register:annual" },
        tone: "soft",
      },
    },
  ],
} satisfies ManagedPageContent;
