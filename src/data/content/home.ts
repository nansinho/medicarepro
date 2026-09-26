/**
 * Contenu de la page d'accueil (/) — refonte 2026 (construction de la
 * référence validée : hero ordinateur + téléphone, essentiels en cartes,
 * sections deux colonnes à puces, offre, FAQ, blog).
 * Conventions : `\n` = <br />, `**…**` = gras, U+00A0 = &nbsp;.
 * Les clés de slots sont nouvelles : les rows de l'ancienne accueil (hero,
 * bento, feature_scroll, manifesto, reviews, cta) ne s'y superposent pas.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_HOME = {
  slug: "/",
  title: "Accueil",
  sections: [
    {
      key: "hero_split",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "MediCare Pro · logiciel de podologie",
        title: "Le logiciel qui simplifie la vie des podologues",
        sub: "Tout votre cabinet réuni,\nde l'examen à la facture.",
        lead: "Bilans podologiques normés, orthèses plantaires, agenda, facturation et comptabilité dans une seule application, hébergée en France.",
        ctas: [
          { label: "Découvrir l'offre", href: "/tarifs" },
          { label: "Demander une démo", href: "/contact" },
        ],
        trust: [
          { icon: "Foot", label: "**13 bilans** podologiques normés" },
          { icon: "ShieldCheck", label: "**Hébergé en France** (HDS)" },
          { icon: "Headset", label: "**Support** 7j/7" },
          { icon: "Clock", label: "**1 jour** pour démarrer" },
        ],
        mockup: "consultation",
        highlight: {
          title: "Traçabilité des kits stérilisés",
          text: "Scannez le QR du lot : la consultation s'enregistre.",
          cta: "Nouveauté",
          icon: "ShieldCheck",
        },
      },
    },
    {
      key: "essentials",
      type: "essentials",
      content: {
        type: "essentials",
        kicker: "Les essentiels",
        title: "Tout votre cabinet,\nen quelques gestes",
        highlight: {
          label: "Bilans podologiques",
          title: "13 bilans normés, scores calculés pour vous.",
          text: "Pied diabétique, chutes, posturologie, sport, pédiatrie… Vous menez l'examen, le logiciel applique la grille, calcule le score et le compare au bilan précédent.",
          note: "Le grade de risque du pied diabétique se calcule pendant l'examen.",
          cta: { label: "Découvrir les bilans", href: "/bilans" },
        },
        cards: [
          {
            label: "Agenda",
            accent: "blue",
            title: "Réservez.\nC'est rappelé.",
            text: "Vos patients réservent en ligne. Les rappels SMS et email partent à J-7 et J-2, sans que vous y pensiez.",
            cta: { label: "En savoir plus", href: "/fonctionnalites#agenda" },
          },
          {
            label: "Facturation",
            accent: "amber",
            title: "Soignez.\nC'est facturé.",
            text: "Chaque acte génère sa facture, numérotée et envoyée au patient. Carte Vitale et ApCV intégrées.",
            cta: { label: "En savoir plus", href: "/fonctionnalites#facturation" },
          },
          {
            label: "Orthèses plantaires",
            accent: "violet",
            title: "Prescrivez.\nC'est tracé.",
            text: "Éléments, matériaux et lot de chaque paire sont rattachés au dossier, prêts pour la matériovigilance.",
            cta: { label: "En savoir plus", href: "/fonctionnalites#statistiques" },
          },
          {
            label: "Compte-rendu",
            accent: "teal",
            title: "Dictez.\nC'est rédigé.",
            text: "Vos observations sont mises en forme par l'IA dans un compte-rendu clinique, que vous relisez et validez.",
            cta: { label: "En savoir plus", href: "/fonctionnalites#ia" },
          },
        ],
      },
    },
    {
      key: "complete",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "ShieldCheck",
        kicker: "",
        title: "Un logiciel de podologie complet et conforme :",
        text: "Une solution fiable, pensée pour les pédicures-podologues libéraux, au cabinet comme à domicile :",
        points: [
          "**Un logiciel 100 % en ligne**, sur ordinateur, tablette et smartphone.",
          "**13 bilans podologiques normés** avec les scores calculés automatiquement.",
          "**Des orthèses plantaires tracées**, de l'empreinte au contrôle.",
          "**Une facturation automatique** à chaque acte, avec lecture de la carte Vitale.",
          "**Une comptabilité tenue au fil de l'eau**, avec export FEC pour votre AGA.",
          "**Un accompagnement humain :** support 7j/7 par chat et reprise de vos données.",
        ],
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg",
          alt: "Une praticienne utilise MediCare Pro sur son ordinateur",
        },
        tone: "white",
        reverse: false,
        cta: { label: "Échanger avec un conseiller", href: "/contact" },
      },
    },
    {
      key: "offer",
      type: "offer_band",
      content: {
        type: "offer_band",
        title: "Offre 12 mois :",
        headline: "MediCare Pro à **24,84 €/mois** seulement",
        compare: "(au lieu de 29,88 €/mois sans engagement)",
        cta: { label: "J'en profite", href: "/tarifs" },
        fine: "Soit 298,08 € TTC par an. Collaborateur supplémentaire : +15 € TTC par mois. Secrétariat inclus.",
      },
    },
    {
      key: "included",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Layers",
        kicker: "",
        title: "L'offre MediCare Pro inclut :",
        text: "",
        points: [
          "**Un logiciel accessible depuis n'importe quel navigateur**, sans installation.",
          "**Installable sur mobile et tablette (PWA)** pour vos soins à domicile, avec scan des ordonnances.",
          "**Un portail patient** : rendez-vous en ligne, documents et suivi des semelles.",
          "**La signature électronique eIDAS** pour vos consentements.",
          "**Des comptes-rendus assistés par IA**, relus et validés par vous.",
          "**Le secrétariat inclus**, sans surcoût.",
        ],
        mockup: "bilan",
        tone: "soft",
        reverse: true,
        cta: { label: "Voir les tarifs", href: "/tarifs" },
      },
    },
    {
      key: "charge",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Clock",
        kicker: "",
        title: "Un logiciel conçu pour alléger votre charge mentale",
        text: "Avec **MediCare Pro**, gagnez du temps, évitez les oublis et simplifiez la gestion de votre cabinet :",
        points: [
          "**Gagnez du temps** : la facture part à la fin de l'acte, sans ressaisie.",
          "**Moins de rendez-vous manqués** grâce aux rappels automatiques à J-7 et J-2.",
          "**Des bilans sans calcul** : les scores et grades se calculent pendant l'examen.",
          "**Une comptabilité à jour**, prête pour votre AGA.",
        ],
        image: {
          mediaId: null,
          path: "/images/fonctionnalites/podologue-medicarepro-section-1.jpg",
          alt: "Une podologue examine le pied d'un patient",
        },
        tone: "white",
        reverse: false,
        cta: { label: "Je prends rendez-vous", href: "/contact" },
      },
    },
    {
      key: "why",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Star",
        kicker: "",
        title: "Pourquoi choisir MediCare Pro ?",
        text: "",
        points: [
          "**Pensé pour la podologie** : bilans, orthèses et vocabulaire du métier.",
          "**Compatible avec tous vos appareils** : Mac, PC, tablette et smartphone.",
          "**Hébergement certifié HDS** en France, chez OVHcloud.",
          "**Un prix unique**, toutes fonctionnalités incluses.",
          "**Plusieurs praticiens** dans un même cabinet, pour 15 € de plus par collaborateur.",
          "**Reprise de vos données** : nous vous accompagnons à l'installation.",
        ],
        image: {
          mediaId: null,
          path: "/images/duo-praticiens.jpg",
          alt: "Deux pédicures-podologues en tenue blanche",
        },
        tone: "soft",
        reverse: true,
        cta: { label: "Je saute le pas", href: "/tarifs" },
      },
    },
    {
      key: "faq",
      type: "faq",
      content: {
        type: "faq",
        kicker: "Questions fréquentes",
        title: "Des questions sur MediCare Pro ?\nOn vous répond ici !",
      },
    },
    {
      key: "blog",
      type: "blog_teaser",
      content: {
        type: "blog_teaser",
        kicker: "Blog",
        title: "Retrouvez nos derniers articles",
        limit: 3,
      },
    },
  ],
} satisfies ManagedPageContent;
