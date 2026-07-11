import type { SectionType } from "@/lib/cms/sections.schema";

/* ============================================================
   Sémantique des formulaires de sections : libellés français,
   champs multilignes, aides. Heuristiques par NOM de champ +
   surcharges ciblées par type. Ce que le zod ne peut pas dire.
   ============================================================ */

/** Libellés FR des noms de champs récurrents. */
const NAME_LABELS: Record<string, string> = {
  kicker: "Sur-titre",
  badge: "Badge",
  title: "Titre",
  lead: "Accroche",
  text: "Texte",
  sub: "Sous-texte",
  note: "Note",
  label: "Libellé",
  href: "Lien",
  image: "Image",
  imagePos: "Position de l'image",
  trust: "Pastilles de confiance",
  items: "Éléments",
  points: "Points",
  quote: "Citation",
  name: "Nom",
  role: "Rôle",
  value: "Valeur",
  heading: "Titre",
  paragraphs: "Paragraphes",
  q: "Question",
  a: "Réponse",
  question: "Question",
  answer: "Réponse",
  icon: "Icône",
  tone: "Tonalité de fond",
  mockup: "Écran animé",
  reverse: "Image à gauche",
  cta: "Bouton d'action",
  ctaBand: "Bandeau d'action",
  link: "Lien",
  steps: "Étapes",
  stats: "Chiffres",
  cards: "Cartes",
  price: "Prix",
  amount: "Montant",
  prefix: "Préfixe",
  suffix: "Suffixe",
  decimals: "Décimales",
  to: "Valeur cible",
  count: "Compteur",
  headline: "Accroche forte",
  avatars: "Avatars",
  proof: "Preuve sociale",
  photos: "Photos",
  infoBar: "Barre d'infos",
  demoCta: "Bouton démo",
  priceCta: "Prix affiché",
  body: "Contenu",
  groups: "Groupes",
  channels: "Canaux",
  form: "Formulaire",
  tools: "Outils",
  before: "Avant",
  after: "Après",
  newsletter: "Newsletter",
  badges: "Badges",
  backgrounds: "Fonds",
  tones: "Tonalités",
  features: "Fonctionnalités",
  posts: "Articles",
  columns: "Colonnes",
  rows: "Lignes",
  tableHead: "En-têtes du tableau",
  navLinks: "Liens de navigation",
};

/** Champs multilignes (textarea) par nom. */
const TEXTAREA_NAMES = new Set([
  "text",
  "lead",
  "quote",
  "sub",
  "note",
  "a",
  "answer",
  "paragraphs",
  "description",
  "tagline",
]);

export function labelFor(path: string): string {
  const name = path.split(".").pop() ?? path;
  return NAME_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function isTextarea(path: string): boolean {
  const name = path.split(".").pop() ?? path;
  return TEXTAREA_NAMES.has(name);
}

/** Aides ciblées (dot-path exact, par type). */
export const FIELD_HELP: Partial<Record<SectionType, Record<string, string>>> = {
  home_hero: {
    title: "Un retour à la ligne = passage à la ligne. **mot** = accent coloré.",
    "proof.headline": "Texte fort de la carte preuve sociale (remplace le compteur).",
  },
  page_hero: {
    title: "Un retour à la ligne = passage à la ligne. **mot** = accent coloré.",
  },
  manifesto: {
    title: "**mot** = accent coloré du design.",
  },
};

export function helpFor(type: SectionType, path: string): string | undefined {
  return FIELD_HELP[type]?.[path];
}
