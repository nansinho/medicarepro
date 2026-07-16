/**
 * Contenu de la page /securite — extraction 1:1 de :
 * src/app/(site)/securite/page.tsx + SecurityHero.tsx.
 * Conventions : `\n` = <br />, `**…**` = accent, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_SECURITE = {
  slug: "/securite",
  title: "Sécurité",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        kicker: "Sécurité & conformité",
        title: "Vos dossiers patients et vos bilans, **protégés au plus haut niveau.**",
        lead: "Bilans podologiques, ordonnances, documents signés : tout ce que contient un dossier patient est hébergé en HDS chez OVHcloud en France, chiffré de bout en bout et conforme RGPD.",
        trust: [
          { icon: "BadgeCheck", label: "Certifié HDS" },
          { icon: "Shield", label: "Conforme RGPD" },
          { icon: "Lock", label: "Chiffré de bout en bout" },
          { icon: "Globe", label: "Données en France" },
        ],
      },
    },
    {
      key: "showcase_1",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Server",
        kicker: "Infrastructure",
        title: "Hébergement HDS en France",
        text: "Les dossiers et bilans de vos patients sont hébergés chez un prestataire certifié Hébergeur de Données de Santé (HDS), exclusivement sur le territoire français. Aucune donnée patient ne quitte la France.",
        points: [
          "Certification HDS conforme à l'article L.1111-8 du Code de la santé publique",
          "Datacenters situés sur le sol français",
          "Redondance et haute disponibilité de l'infrastructure",
          "Isolation stricte des environnements de production",
        ],
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section1.jpg",
          alt: "Baies de serveurs hébergeant les données de santé MediCare Pro",
        },
        tone: "white",
        reverse: false,
      },
    },
    {
      key: "showcase_2",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Globe",
        kicker: "Hébergeur",
        title: "Hébergé chez OVHcloud, datacenters en France",
        text: "Nous nous appuyons sur OVHcloud, leader européen du cloud et hébergeur certifié HDS. Les données de votre patientèle sont stockées dans ses datacenters français, sous souveraineté européenne, à l'abri des législations extra-européennes.",
        points: [
          "OVHcloud : hébergeur certifié HDS et souveraineté européenne",
          "Datacenters Tier III+ en France, sécurisés 24h/24",
          "Aucune dépendance au Cloud Act américain",
          "Engagement de réversibilité de vos données",
        ],
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section2.jpg",
          alt: "Couloir de datacenter OVHcloud hébergeant MediCare Pro",
        },
        tone: "dark",
        reverse: true,
      },
    },
    {
      key: "showcase_3",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Lock",
        kicker: "Chiffrement",
        title: "Chiffrement de bout en bout",
        text: "Du bilan diabétique à la facture, vos données sont chiffrées en transit et au repos. Les communications passent par des canaux TLS et le stockage est protégé par un chiffrement AES robuste : même en cas d'accès physique, les données restent illisibles.",
        points: [
          "Chiffrement AES-256 des données au repos",
          "Connexions chiffrées TLS 1.3 de bout en bout",
          "Authentification forte pour bloquer tout accès non autorisé",
          "Cloisonnement des accès par rôle (podologue, cabinet)",
        ],
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section3.jpg",
          alt: "Flux de données chiffrées illustré par du code binaire",
        },
        tone: "soft",
        reverse: false,
      },
    },
    {
      key: "showcase_4",
      type: "showcase",
      content: {
        type: "showcase",
        icon: "Shield",
        kicker: "Conformité",
        title: "Conformité RGPD & droits des patients",
        text: "Le traitement des données de votre cabinet respecte le Règlement Général sur la Protection des Données : finalités déclarées, minimisation, consentement et respect intégral des droits de vos patients. Vous restez maître de vos données.",
        points: [
          "Finalités de traitement déclarées et limitées",
          "Droit d'accès, de rectification et d'effacement garantis",
          "Registre des traitements tenu à jour",
          "Sous-traitants conformes RGPD et localisés en Europe",
        ],
        image: {
          mediaId: null,
          path: "/images/securite/podologue-medicarepro-servers-section4.jpg",
          alt: "Conformité RGPD et souveraineté des données européennes",
        },
        tone: "dark",
        reverse: true,
      },
    },
    {
      key: "guarantees",
      type: "stats_band",
      content: {
        type: "stats_band",
        kicker: "Nos garanties",
        title: "La sécurité, mesurée et garantie",
        stats: [
          {
            icon: "Server",
            to: 99.9,
            decimals: 1,
            suffix: " %",
            label: "de disponibilité garantie",
          },
          {
            icon: "Key",
            to: 256,
            suffix: " bits",
            label: "de chiffrement AES des données",
          },
          {
            icon: "Refresh",
            to: 24,
            suffix: " h",
            label: "fréquence des sauvegardes",
          },
          {
            icon: "Globe",
            to: 100,
            suffix: " %",
            label: "des données hébergées en France",
          },
        ],
      },
    },
    {
      key: "host",
      type: "host_band",
      content: {
        type: "host_band",
        kicker: "Infrastructure de confiance",
        title: "Un hébergement souverain, en qui vous pouvez avoir confiance",
        text: "MediCare Pro s'appuie sur OVHcloud, leader européen du cloud et acteur reconnu de l'hébergement de données de santé. Vos données patients restent en France, sous protection européenne.",
        points: [
          "Hébergeur agréé pour les données de santé (HDS)",
          "Souveraineté européenne, hors Cloud Act",
          "Datacenters français sécurisés en continu",
        ],
        logoCaption: "Hébergeur certifié HDS",
      },
    },
    {
      key: "portal",
      type: "portal_cards",
      content: {
        type: "portal_cards",
        kicker: "Aller plus loin",
        title: "Découvrir MediCare Pro",
        linkLabel: "Découvrir",
        cards: [
          {
            icon: "FileText",
            title: "Toutes les fonctionnalités",
            text: "Facturation, signature, comptabilité, agenda, bilans et application mobile : tout votre cabinet réuni.",
            href: "/fonctionnalites",
          },
          {
            icon: "CheckCircle",
            title: "Tarifs tout inclus",
            text: "Un seul abonnement, sans option cachée. Sécurité, mises à jour et support compris.",
            href: "/tarifs",
          },
          {
            icon: "BadgeCheck",
            title: "Les 13 bilans podologiques",
            text: "Des bilans normés avec scores calculés automatiquement, pour un suivi patient sécurisé.",
            href: "/bilans",
          },
        ],
      },
    },
    {
      key: "cta",
      type: "cta_panel",
      content: {
        type: "cta_panel",
        kicker: "Vos patients méritent le meilleur",
        title: "Vos données patients, entre de bonnes mains",
        lead: "Hébergement HDS en France, chiffrement de bout en bout et conformité RGPD : tout est inclus, à partir de 24,84 €/mois.",
        primary: { label: "Je m'abonne", href: "app:register:annual" },
        secondary: { label: "Demander une démo", href: "/contact" },
      },
    },
  ],
} satisfies ManagedPageContent;
