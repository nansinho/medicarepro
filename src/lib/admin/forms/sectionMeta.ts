import type { SectionType } from "@/lib/cms/sections.schema";

/* Libellés français des types de sections (éditeur de pages). */
export const SECTION_TYPE_LABELS: Record<
  SectionType,
  { label: string; description: string }
> = {
  page_hero: { label: "En-tête de page", description: "Titre, accroche et pastilles de confiance" },
  home_hero: { label: "Héro de l'accueil", description: "Titre, CTA, prix et preuve sociale" },
  bento: { label: "Grille bento", description: "L'essentiel du produit en mosaïque" },
  feature_scroll: { label: "Défilement fonctionnalités", description: "Parcours sticky des fonctionnalités" },
  manifesto: { label: "Manifesto", description: "Le « pourquoi » en une phrase" },
  stats_band: { label: "Bandeau de chiffres", description: "Compteurs animés" },
  timeline: { label: "Frise / étapes", description: "Parcours en étapes numérotées" },
  story: { label: "Histoire", description: "Paragraphes narratifs" },
  values: { label: "Valeurs", description: "Cartes icône + titre + texte" },
  feature_showcase: { label: "Vitrine de fonctionnalités", description: "Sections alternées avec fonds" },
  showcase: { label: "Vitrine", description: "Image + points + mockup" },
  reviews: { label: "Avis", description: "Témoignages (collection) + note" },
  faq: { label: "FAQ", description: "Questions / réponses" },
  pricing: { label: "Tarifs", description: "Formules (collection) + tableau" },
  savings_compare: { label: "Comparateur d'économies", description: "Avant / après MediCare Pro" },
  cta_band: { label: "Bandeau CTA", description: "Appel à l'action pleine largeur" },
  cta_panel: { label: "Panneau CTA", description: "Appel à l'action final" },
  cross_links: { label: "Liens croisés", description: "Renvois vers d'autres pages" },
  contact_channels: { label: "Canaux de contact", description: "Coordonnées + formulaire" },
  contact_steps: { label: "Étapes contact", description: "Ce qui se passe après l'envoi" },
  benefit_band: { label: "Bandeau bénéfices", description: "Avantages en icônes" },
  bilan_groups: { label: "Groupes de bilans", description: "Les 13 bilans par famille" },
  portal_cards: { label: "Cartes portail", description: "Accès app / espace patient" },
  host_band: { label: "Bandeau hébergement", description: "HDS / OVHcloud" },
  rich_text: { label: "Texte riche", description: "Contenu libre (pages légales)" },
  blog_teaser: { label: "Teaser blog", description: "Derniers articles" },
  city_hero: { label: "Héro ville", description: "En-tête des pages villes" },
  city_intro: { label: "Intro ville", description: "Paragraphes localisés" },
  city_faq: { label: "FAQ ville", description: "Questions localisées" },
};
