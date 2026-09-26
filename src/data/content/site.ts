/**
 * Contenu transversal du site (futures tables `menus`, `site_settings`,
 * `seo_meta`) — extraction 1:1 de : Header.tsx, Footer.tsx, SideTabs.tsx,
 * src/app/layout.tsx, src/app/sitemap.ts et des `metadata` de chaque page.
 * Conventions : `\n` = <br />, U+00A0 = &nbsp; ; href spéciaux "app:*"
 * résolus via src/lib/appLinks.ts.
 */
import type { IconKey } from "@/lib/cms/sections.schema";

/* ------------------------------------------------------------------ */
/* Menus (NAV_LINKS de Header.tsx, colonnes de Footer.tsx)              */
/* ------------------------------------------------------------------ */

export type MenuItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const MENUS = {
  header: [
    {
      label: "Le logiciel",
      href: "/fonctionnalites",
      children: [
        { label: "Toutes les fonctionnalités", href: "/fonctionnalites" },
        { label: "Agenda et rappels", href: "/fonctionnalites#agenda" },
        { label: "Bilans podologiques", href: "/bilans" },
        { label: "Facturation et carte Vitale", href: "/fonctionnalites#facturation" },
        { label: "Comptabilité", href: "/fonctionnalites#comptabilite" },
        { label: "Avantages", href: "/avantages" },
      ],
    },
    {
      label: "Nos services",
      href: "/tarifs",
      children: [
        { label: "Tarifs", href: "/tarifs" },
        { label: "Sécurité et hébergement HDS", href: "/securite" },
        { label: "Démonstration personnalisée", href: "/contact" },
      ],
    },
    { label: "Partout en France", href: "/logiciel-podologue" },
    {
      label: "Ressources",
      href: "/blog",
      children: [
        { label: "Blog", href: "/blog" },
        { label: "Questions fréquentes", href: "/tarifs#faq" },
        { label: "Qui sommes-nous ?", href: "/a-propos" },
      ],
    },
  ],
  footer_product: [
    { label: "Fonctionnalités", href: "/fonctionnalites" },
    { label: "Bilans", href: "/bilans" },
    { label: "Sécurité", href: "/securite" },
    { label: "Avantages", href: "/avantages" },
    { label: "Tarifs", href: "/tarifs" },
    { label: "Contact", href: "/contact" },
  ],
  footer_resources: [
    { label: "À propos", href: "/a-propos" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/tarifs" },
    { label: "Plan du site", href: "/plan-du-site" },
    { label: "Confidentialité", href: "/confidentialite" },
    { label: "CGU", href: "/cgu" },
    { label: "CGV", href: "/cgv" },
    { label: "DPA", href: "/dpa" },
    { label: "Cookies", href: "/cookies" },
    { label: "Mentions légales", href: "/mentions-legales" },
  ],
} satisfies Record<string, MenuItem[]>;

/* ------------------------------------------------------------------ */
/* Réglages du site (site_settings)                                    */
/* ------------------------------------------------------------------ */

export type SocialLink = { label: string; icon: IconKey; href: string };

export const SETTINGS = {
  /** Coordonnées de contact (header drawer, footer, page contact). */
  contact: {
    phone: "07 62 59 66 53",
    phoneHref: "tel:+33762596653",
    email: "contact@medicarepro.fr",
    address: "340 Chem. du Plan Marseillais, 13320 Bouc-Bel-Air",
  },

  /** Réseaux sociaux (pied de page et rail du bord gauche). */
  socials: [
    { label: "Facebook", icon: "Facebook", href: "https://www.facebook.com/people/MedicarePro/61594602694325/" },
    { label: "Instagram", icon: "Instagram", href: "https://www.instagram.com/medicarepro.fr/" },
    { label: "YouTube", icon: "YouTube", href: "https://www.youtube.com/@medicarepro-fr" },
  ] satisfies SocialLink[],

  /** Header + panneau latéral (drawer). */
  header: {
    logoLabel: "MediCare Pro",
    loginLabel: "Connexion",
    drawer: {
      title: "Votre partenaire pour la\nsanté du cabinet",
      followLabel: "Suivez-nous",
      socials: [
        { label: "Facebook", icon: "Facebook", href: "https://www.facebook.com/people/MedicarePro/61594602694325/" },
        { label: "Instagram", icon: "Instagram", href: "https://www.instagram.com/medicarepro.fr/" },
        { label: "YouTube", icon: "YouTube", href: "https://www.youtube.com/@medicarepro-fr" },
      ] satisfies SocialLink[],
    },
  },

  /** Footer. */
  footer: {
    tagline:
      "Le logiciel tout-en-un des podologues : dossiers patients, bilans, facturation, agenda et comptabilité réunis au même endroit.",
    productHeading: "Produit",
    resourcesHeading: "Ressources",
    newsletter: {
      heading: "Restez informé",
      text: "Conseils et nouveautés pour votre cabinet, une fois par mois.",
      placeholder: "vous@email.com",
      inputLabel: "Votre adresse email",
      buttonLabel: "Envoyer",
    },
    badges: [
      { icon: null, label: "Hébergé en France · HDS" },
      { icon: "ShieldCheck", label: "RGPD · Données chiffrées" },
    ] satisfies { icon: IconKey | null; label: string }[],
    copyright: "© 2026 MediCare Pro. Tous droits réservés.",
    followLabel: "Suivez-nous",
  },

  /** Onglets latéraux fixes (SideTabs.tsx). */
  sideTabs: {
    review: { label: "Laissez un avis", href: "#", icon: "Star" as IconKey },
    subscribe: {
      label: "Je m'abonne",
      href: "app:register",
      icon: "ShieldPlus" as IconKey,
    },
  },

  /** Preuve sociale (bandeau des avis). */
  rating: {
    value: "4,9/5",
    label: "note moyenne · podologues abonnés",
  },

  /** Bandeau promotionnel au-dessus de l'en-tête (géré depuis le back
   *  office). `**…**` = gras, `~~…~~` = prix barré. */
  promoBanner: {
    enabled: true,
    text: "**Offre 12 mois :** MediCare Pro à **24,84 €/mois** au lieu de ~~29,88 €/mois~~",
    href: "/tarifs",
    linkLabel: "J'en profite",
  },
};

/* ------------------------------------------------------------------ */
/* SEO par route (seo_meta) — metadata + sitemap actuels                */
/* ------------------------------------------------------------------ */

export type SeoDefault = {
  title: string;
  /** true = titre complet sans template « %s | MediCare Pro ». */
  titleAbsolute?: boolean;
  description: string;
  canonical: string;
  sitemapPriority: number;
  sitemapChangefreq: "weekly" | "monthly" | "yearly";
};

export const SEO_DEFAULTS = {
  "/": {
    title: "MediCare Pro | Logiciel tout-en-un pour podologues",
    titleAbsolute: true,
    description:
      "Dossiers patients, facturation automatique, agenda, 13 bilans et comptabilité : tout votre cabinet de podologie dans une seule application, dès 24,84 €/mois.",
    canonical: "/",
    sitemapPriority: 1,
    sitemapChangefreq: "weekly",
  },
  "/fonctionnalites": {
    title: "Fonctionnalités du logiciel podologue",
    description:
      "Toutes les fonctionnalités de MediCare Pro : facturation automatique, signature électronique eIDAS, comptabilité, agenda intégré, 13 bilans podologiques et accès sur mobile (PWA).",
    canonical: "/fonctionnalites",
    sitemapPriority: 0.8,
    sitemapChangefreq: "monthly",
  },
  "/bilans": {
    title: "Logiciel de bilan podologique : 13 bilans spécialisés",
    description:
      "13 bilans podologiques normés, scores calculés automatiquement : diabétique, chutes, posturologie, pédiatrie et plus. Tout inclus dans l'abonnement.",
    canonical: "/bilans",
    sitemapPriority: 0.8,
    sitemapChangefreq: "monthly",
  },
  "/securite": {
    title: "Sécurité et conformité des données de santé",
    description:
      "Hébergement HDS chez OVHcloud en France, conformité RGPD, chiffrement de bout en bout et sauvegardes quotidiennes : vos données patients sont protégées.",
    canonical: "/securite",
    sitemapPriority: 0.8,
    sitemapChangefreq: "monthly",
  },
  "/avantages": {
    title: "Les avantages du logiciel tout-en-un",
    description:
      "Tout-en-un, simple, rapide : pourquoi les podologues choisissent MediCare Pro. Jusqu'à 260 €/mois économisés vs des outils séparés, dès 24,84 €/mois.",
    canonical: "/avantages",
    sitemapPriority: 0.8,
    sitemapChangefreq: "monthly",
  },
  "/tarifs": {
    title: "Tarifs",
    description:
      "Une offre unique tout inclus : sans engagement à 29,88 € TTC/mois ou offre 12 mois à 24,84 € TTC/mois (−17 %). Service secrétariat gratuit, conforme HDS et RGPD.",
    canonical: "/tarifs",
    sitemapPriority: 0.8,
    sitemapChangefreq: "monthly",
  },
  "/a-propos": {
    title: "À propos",
    description:
      "MediCare Pro, le logiciel de gestion de cabinet conçu par et pour les podologues. Notre mission : centraliser tout votre cabinet dans une seule application.",
    canonical: "/a-propos",
    sitemapPriority: 0.6,
    sitemapChangefreq: "monthly",
  },
  "/blog": {
    title: "Blog",
    description:
      "Conseils et actualités pour les podologues : suivi du pied diabétique, orthèses plantaires, posturologie et bonnes pratiques de cabinet.",
    canonical: "/blog",
    sitemapPriority: 0.6,
    sitemapChangefreq: "weekly",
  },
  "/contact": {
    title: "Contact",
    description:
      "Contactez MediCare Pro pour vous abonner ou demander une démonstration. Hébergement HDS en France, données chiffrées et conformes RGPD.",
    canonical: "/contact",
    sitemapPriority: 0.6,
    sitemapChangefreq: "monthly",
  },
  "/mentions-legales": {
    title: "Mentions légales",
    description:
      "Mentions légales du site medicarepro.fr : éditeur, directeur de la publication, hébergement et propriété intellectuelle.",
    canonical: "/mentions-legales",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/cgu": {
    title: "Conditions générales d'utilisation",
    description:
      "Conditions générales d'utilisation du site medicarepro.fr : accès au site, propriété intellectuelle, responsabilité et données personnelles.",
    canonical: "/cgu",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/cgv": {
    title: "Conditions générales de vente",
    description:
      "Conditions générales de vente de l'abonnement MediCare Pro : tarifs, souscription en ligne, paiement par carte (Monetico), reconduction automatique et résiliation.",
    canonical: "/cgv",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/confidentialite": {
    title: "Politique de confidentialité",
    description:
      "Politique de confidentialité de medicarepro.fr : données collectées, finalités, durées de conservation, hébergement HDS et droits RGPD.",
    canonical: "/confidentialite",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/dpa": {
    title: "Accord de Traitement des Données (DPA)",
    description:
      "Accord de traitement des données (DPA) de MediCare Pro, annexe 1 des CGV : sous-traitance des données de santé conformément à l'article 28 du RGPD.",
    canonical: "/dpa",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/cookies": {
    title: "Politique de Cookies",
    description:
      "Politique de cookies de MediCare Pro : cookies techniques uniquement, sans traceur publicitaire ni analytique, conformément à la directive ePrivacy et à la CNIL.",
    canonical: "/cookies",
    sitemapPriority: 0.2,
    sitemapChangefreq: "yearly",
  },
  "/plan-du-site": {
    title: "Plan du site",
    description:
      "Toutes les pages de MediCare Pro en un coup d'œil : fonctionnalités, bilans podologiques, sécurité, tarifs, blog et informations légales.",
    canonical: "/plan-du-site",
    sitemapPriority: 0.3,
    sitemapChangefreq: "monthly",
  },
} satisfies Record<string, SeoDefault>;

/* ------------------------------------------------------------------ */
/* JSON-LD global (src/app/layout.tsx)                                  */
/* ------------------------------------------------------------------ */

export const JSONLD_ORG = {
  "@type": "Organization",
  "@id": "https://medicarepro.fr/#organization",
  name: "MediCare Pro",
  url: "https://medicarepro.fr",
  email: "contact@medicarepro.fr",
  description:
    "Éditeur du logiciel MediCare Pro, solution tout-en-un de gestion de cabinet pour pédicures-podologues.",
};

export const JSONLD_SOFTWARE = {
  "@type": "SoftwareApplication",
  "@id": "https://medicarepro.fr/#software",
  name: "MediCare Pro",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://medicarepro.fr",
  description:
    "Logiciel de gestion de cabinet pour podologues : dossiers patients, facturation automatique, agenda, 13 bilans podologiques, comptabilité et signature électronique. Hébergement HDS en France.",
  offers: {
    "@type": "Offer",
    price: "24.84",
    priceCurrency: "EUR",
    description: "Abonnement mensuel TTC (offre 12 mois), tout inclus.",
  },
  publisher: { "@id": "https://medicarepro.fr/#organization" },
  inLanguage: "fr-FR",
};

/* ------------------------------------------------------------------ */
/* Pied de page : bandeau d'appel, texte de référencement, crédit       */
/* ------------------------------------------------------------------ */

/** Bandeau d'appel en tête du pied de page. */
export const FOOTER_CTA = {
  title: "Prêt à simplifier votre cabinet ?",
  text: "Une démonstration de 30 minutes sur vos cas concrets, gratuite et sans engagement.",
  primary: { label: "Demander une démo", href: "/contact" },
  secondary: { label: "Voir les tarifs", href: "/tarifs" },
};

/** Texte de référencement du pied de page : ce que fait le logiciel, pour
 *  qui, où, avec des liens internes aux intitulés recherchés. Tout ce qui
 *  est écrit ici doit rester vrai (voir src/data/features.ts). */
export const FOOTER_SEO = {
  title: "MediCare Pro, le logiciel des pédicures-podologues",
  paragraphs: [
    "MediCare Pro est un logiciel de gestion de cabinet conçu pour les pédicures-podologues libéraux. Il réunit le dossier patient, 13 bilans podologiques normés (pied diabétique, risque de chute, posturologie, pédiatrie, sport…), le suivi des orthèses plantaires, l'agenda en ligne avec rappels SMS et e-mail, la facturation avec lecture de la carte Vitale et de l'ApCV, la comptabilité avec export FEC et la signature électronique eIDAS.",
    "Accessible depuis un navigateur, sur ordinateur, tablette et smartphone (PWA), il accompagne le podologue au cabinet comme en soins à domicile, partout en France métropolitaine et en outre-mer. Les données de santé sont hébergées en France chez OVHcloud, hébergeur certifié HDS, dans le respect du RGPD.",
  ],
  searchesTitle: "Recherches fréquentes",
  searches: [
    { label: "Logiciel podologue", href: "/fonctionnalites" },
    { label: "Logiciel de bilan podologique", href: "/bilans" },
    { label: "Bilan du pied diabétique", href: "/bilans" },
    { label: "Bilan de risque de chute", href: "/bilans" },
    { label: "Agenda en ligne pour podologue", href: "/fonctionnalites#agenda" },
    { label: "Facturation podologue et carte Vitale", href: "/fonctionnalites#facturation" },
    { label: "Comptabilité podologue, export FEC", href: "/fonctionnalites#comptabilite" },
    { label: "Logiciel podologue hébergé HDS", href: "/securite" },
    { label: "Prix d'un logiciel de podologie", href: "/tarifs" },
    { label: "Logiciel podologue près de chez vous", href: "/logiciel-podologue" },
  ],
};

/** Crédit de réalisation du site. */
export const FOOTER_CREDIT = {
  label: "Site créé par",
  name: "agencehds.fr",
  href: "https://agencehds.fr",
};
