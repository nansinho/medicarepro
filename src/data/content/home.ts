/**
 * Contenu de la page d'accueil (/) — extraction 1:1 de :
 * src/app/(site)/page.tsx, Hero.tsx, HomeBento.tsx, HomeFeatureScroll.tsx.
 * Conventions : `\n` = <br />, `**…**` = accent/gras, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_HOME = {
  slug: "/",
  title: "Accueil",
  sections: [
    {
      key: "hero",
      type: "home_hero",
      content: {
        type: "home_hero",
        title: "Tout votre cabinet dans\nune seule application",
        lead: "Le logiciel complet de gestion pour podologues,\npour vous faire gagner du temps au quotidien.",
        demoCta: { label: "Voir la démo", href: "/contact" },
        priceCta: {
          label: "abonnement",
          amount: "24,84 €",
          note: "/mois · tout inclus",
          href: "/tarifs",
        },
        proof: {
          count: 1000,
          prefix: "+",
          label: "podologues équipés",
          avatars: [
            { mediaId: null, path: "/images/avatars/av1.jpg", alt: "Podologue équipé 1" },
            { mediaId: null, path: "/images/avatars/av2.jpg", alt: "Podologue équipé 2" },
            { mediaId: null, path: "/images/avatars/av3.jpg", alt: "Podologue équipé 3" },
            { mediaId: null, path: "/images/avatars/av4.jpg", alt: "Podologue équipé 4" },
            { mediaId: null, path: "/images/avatars/av5.jpg", alt: "Podologue équipé 5" },
            { mediaId: null, path: "/images/avatars/av6.jpg", alt: "Podologue équipé 6" },
            { mediaId: null, path: "/images/avatars/av7.jpg", alt: "Podologue équipé 7" },
            { mediaId: null, path: "/images/avatars/av8.jpg", alt: "Podologue équipé 8" },
          ],
        },
        photos: {
          duo: {
            mediaId: null,
            path: "/images/hero-duo.png",
            alt: "Deux praticiens souriants utilisant MediCare Pro",
          },
        },
        infoBar: {
          items: [
            { icon: "Phone", title: "Téléphone", value: "01 23 45 67 89" },
            { icon: "Headset", title: "Support", value: "7j/7 par chat" },
            { icon: "MapPin", title: "Hébergement", value: "HDS · France" },
          ],
          cta: { label: "Je m'abonne", href: "app:register:annual" },
        },
      },
    },
    {
      key: "bento",
      type: "bento",
      content: {
        type: "bento",
        kicker: "Pourquoi MediCare Pro",
        title: "L'essentiel, en un coup d'œil",
        lead: "Un seul outil remplace votre agenda, votre facturation, vos bilans et votre comptabilité.",
        mockup: {
          kicker: "Agenda & RDV en ligne",
          title: "Vos patients réservent seuls, l'agenda se remplit",
          kind: "agenda",
        },
        counters: [
          {
            icon: "Wallet",
            to: 260,
            prefix: "−",
            suffix: " €",
            label: "économisés chaque mois face aux outils séparés",
          },
          {
            icon: "FileText",
            to: 13,
            label: "bilans podologiques normés, scores calculés automatiquement",
          },
          {
            icon: "Zap",
            to: 100,
            suffix: " %",
            label: "de la facturation générée automatiquement, sans ressaisie",
          },
        ],
        hds: {
          icon: "ShieldCheck",
          title: "Hébergé en France",
          sub: "HDS · RGPD · chiffré",
        },
      },
    },
    {
      key: "feature_scroll",
      type: "feature_scroll",
      content: {
        type: "feature_scroll",
        kicker: "Tout votre cabinet",
        title: "Une fonctionnalité pour chaque besoin",
        limit: 6,
      },
    },
    {
      key: "manifesto",
      type: "manifesto",
      content: {
        type: "manifesto",
        kicker: "Notre mission",
        title: "Moins d'administratif.\nPlus de podologie.",
        text: "MediCare Pro est né dans un cabinet, pas dans un open space. Chaque fonctionnalité répond à un vrai besoin du quotidien — conçu par des podologues, pour des podologues.",
        link: { label: "Découvrir notre histoire", href: "/a-propos" },
      },
    },
    {
      key: "reviews",
      type: "reviews",
      content: {
        type: "reviews",
        kicker: "Avis de podologues",
        title: "Ils nous font confiance",
        tone: "soft",
        rating: {
          value: "4,9/5",
          label: "note moyenne · podologues abonnés",
        },
      },
    },
    {
      key: "cta",
      type: "cta_panel",
      content: {
        type: "cta_panel",
        kicker: "Prêt à simplifier votre cabinet ?",
        title: "Tout votre cabinet réuni, pour 24,84 €/mois",
        lead: "Tout-en-un, sans option cachée — et plus de 3 000 € économisés par an en moyenne face aux outils séparés.",
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
