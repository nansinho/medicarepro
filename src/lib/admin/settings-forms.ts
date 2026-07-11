import { z } from "zod";
import { IconKeySchema } from "@/lib/cms/sections.schema";

/* ============================================================
   Réglages du site — schémas de validation + descripteurs de
   formulaires. LA règle : chaque schéma reproduit EXACTEMENT la
   forme canonique du fallback (src/data/content/site.ts) — une
   valeur d'une autre forme serait silencieusement ignorée au
   rendu (garde sameShape de src/lib/cms/settings.ts).
   Fichier client-safe (importé par les formulaires ET l'action).
   ============================================================ */

const SocialSchema = z.object({
  label: z.string().min(1),
  icon: IconKeySchema,
  href: z.string().min(1),
});

export const SETTINGS_SCHEMAS = {
  contact: z.object({
    phone: z.string().min(1),
    phoneHref: z.string().min(1),
    email: z.string().min(3),
    address: z.string().min(1),
  }),
  socials: z.array(SocialSchema),
  header: z.object({
    logoLabel: z.string().min(1),
    loginLabel: z.string().min(1),
    drawer: z.object({
      title: z.string().min(1),
      followLabel: z.string().min(1),
      socials: z.array(SocialSchema),
    }),
  }),
  footer: z.object({
    tagline: z.string().min(1),
    productHeading: z.string().min(1),
    resourcesHeading: z.string().min(1),
    newsletter: z.object({
      heading: z.string().min(1),
      text: z.string().min(1),
      placeholder: z.string().min(1),
      inputLabel: z.string().min(1),
      buttonLabel: z.string().min(1),
    }),
    badges: z.array(
      z.object({ icon: IconKeySchema.nullable(), label: z.string().min(1) }),
    ),
    copyright: z.string().min(1),
    followLabel: z.string().min(1),
  }),
  sideTabs: z.object({
    review: z.object({
      label: z.string().min(1),
      href: z.string().min(1),
      icon: IconKeySchema,
    }),
    subscribe: z.object({
      label: z.string().min(1),
      href: z.string().min(1),
      icon: IconKeySchema,
    }),
  }),
  rating: z.object({
    value: z.string().min(1),
    label: z.string().min(1),
  }),
  promoBanner: z.object({
    enabled: z.boolean(),
    text: z.string(),
    href: z.string(),
    linkLabel: z.string(),
  }),
  legal_entity: z.object({
    raison_sociale: z.string(),
    siret: z.string(),
    tva: z.string(),
    directeur: z.string(),
    adresse: z.string(),
    date_maj_cgu: z.string(),
    date_maj_confidentialite: z.string(),
    date_maj_mentions: z.string(),
  }),
} as const;

export type EditableSettingKey = keyof typeof SETTINGS_SCHEMAS;

export const EDITABLE_SETTING_KEYS = Object.keys(
  SETTINGS_SCHEMAS,
) as EditableSettingKey[];

/** Squelette legal_entity (clé seedée hors fallback SETTINGS). */
export const LEGAL_ENTITY_DEFAULT = {
  raison_sociale: "",
  siret: "",
  tva: "",
  directeur: "",
  adresse: "",
  date_maj_cgu: "",
  date_maj_confidentialite: "",
  date_maj_mentions: "",
};

/* ------------------------------------------------------------------ */
/* Descripteurs de formulaires                                         */
/* ------------------------------------------------------------------ */

export type SettingField =
  | {
      kind: "text" | "textarea" | "toggle" | "icon";
      path: string;
      label: string;
      help?: string;
      /** icon uniquement : autorise « aucune icône » (null). */
      allowNone?: boolean;
    }
  | {
      kind: "array";
      path: string;
      label: string;
      help?: string;
      columns: {
        kind: "text" | "icon";
        path: string;
        label: string;
        allowNone?: boolean;
      }[];
      newItem: () => unknown;
    };

export type SettingSection = {
  key: EditableSettingKey;
  title: string;
  description: string;
  adminNote?: string;
  fields: SettingField[];
};

export const ICON_CHOICES = IconKeySchema.options;

export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    key: "promoBanner",
    title: "Bandeau promotionnel",
    description:
      "Bandeau affiché tout en haut du site, au-dessus du menu. Activez-le pour une offre ou une annonce ponctuelle.",
    fields: [
      { kind: "toggle", path: "enabled", label: "Afficher le bandeau" },
      {
        kind: "text",
        path: "text",
        label: "Texte de l'annonce",
        help: "Une phrase courte — le bandeau tient sur une ligne.",
      },
      {
        kind: "text",
        path: "href",
        label: "Lien (optionnel)",
        help: "Chemin interne (/tarifs), URL complète, ou lien app:register.",
      },
      { kind: "text", path: "linkLabel", label: "Libellé du lien" },
    ],
  },
  {
    key: "contact",
    title: "Coordonnées",
    description:
      "Téléphone, email et adresse affichés dans le menu, le pied de page et la page contact.",
    fields: [
      { kind: "text", path: "phone", label: "Téléphone (affiché)" },
      {
        kind: "text",
        path: "phoneHref",
        label: "Téléphone (lien tel:)",
        help: "Format international, ex. tel:+33762596653",
      },
      { kind: "text", path: "email", label: "Email de contact" },
      { kind: "textarea", path: "address", label: "Adresse postale" },
    ],
  },
  {
    key: "socials",
    title: "Réseaux sociaux",
    description: "Liens affichés dans le pied de page.",
    fields: [
      {
        kind: "array",
        path: "",
        label: "Réseaux",
        columns: [
          { kind: "text", path: "label", label: "Nom" },
          { kind: "icon", path: "icon", label: "Icône" },
          { kind: "text", path: "href", label: "Lien" },
        ],
        newItem: () => ({ label: "", icon: "Facebook", href: "#" }),
      },
    ],
  },
  {
    key: "header",
    title: "Menu & panneau latéral",
    description: "Textes du header et du menu latéral mobile (drawer).",
    fields: [
      { kind: "text", path: "logoLabel", label: "Libellé du logo (alt)" },
      { kind: "text", path: "loginLabel", label: "Bouton connexion" },
      {
        kind: "textarea",
        path: "drawer.title",
        label: "Titre du panneau latéral",
        help: "Un retour à la ligne = passage à la ligne sur le site.",
      },
      { kind: "text", path: "drawer.followLabel", label: "Libellé « suivez-nous »" },
      {
        kind: "array",
        path: "drawer.socials",
        label: "Réseaux du panneau",
        columns: [
          { kind: "text", path: "label", label: "Nom" },
          { kind: "icon", path: "icon", label: "Icône" },
          { kind: "text", path: "href", label: "Lien" },
        ],
        newItem: () => ({ label: "", icon: "Instagram", href: "#" }),
      },
    ],
  },
  {
    key: "footer",
    title: "Pied de page",
    description: "Textes, newsletter et badges du pied de page.",
    fields: [
      { kind: "textarea", path: "tagline", label: "Phrase d'accroche" },
      { kind: "text", path: "productHeading", label: "Titre colonne produit" },
      { kind: "text", path: "resourcesHeading", label: "Titre colonne ressources" },
      { kind: "text", path: "newsletter.heading", label: "Newsletter — titre" },
      { kind: "textarea", path: "newsletter.text", label: "Newsletter — texte" },
      { kind: "text", path: "newsletter.placeholder", label: "Newsletter — placeholder" },
      { kind: "text", path: "newsletter.inputLabel", label: "Newsletter — label du champ" },
      { kind: "text", path: "newsletter.buttonLabel", label: "Newsletter — bouton" },
      {
        kind: "array",
        path: "badges",
        label: "Badges de confiance",
        columns: [
          { kind: "icon", path: "icon", label: "Icône", allowNone: true },
          { kind: "text", path: "label", label: "Texte" },
        ],
        newItem: () => ({ icon: null, label: "" }),
      },
      { kind: "text", path: "copyright", label: "Copyright" },
      { kind: "text", path: "followLabel", label: "Libellé « suivez-nous »" },
    ],
  },
  {
    key: "sideTabs",
    title: "Onglets latéraux",
    description:
      "Les deux pastilles fixes sur les côtés du site (avis + abonnement).",
    fields: [
      { kind: "text", path: "review.label", label: "Avis — texte" },
      { kind: "text", path: "review.href", label: "Avis — lien" },
      { kind: "icon", path: "review.icon", label: "Avis — icône" },
      { kind: "text", path: "subscribe.label", label: "Abonnement — texte" },
      { kind: "text", path: "subscribe.href", label: "Abonnement — lien" },
      { kind: "icon", path: "subscribe.icon", label: "Abonnement — icône" },
    ],
  },
  {
    key: "rating",
    title: "Note moyenne",
    description: "Preuve sociale affichée avec les avis.",
    fields: [
      { kind: "text", path: "value", label: "Note (ex. 4,9/5)" },
      { kind: "text", path: "label", label: "Légende" },
    ],
  },
  {
    key: "legal_entity",
    title: "Entité légale",
    description:
      "Informations société utilisées par les pages légales (mentions, CGU, confidentialité).",
    fields: [
      { kind: "text", path: "raison_sociale", label: "Raison sociale" },
      { kind: "text", path: "siret", label: "SIRET" },
      { kind: "text", path: "tva", label: "N° TVA" },
      { kind: "text", path: "directeur", label: "Directeur de la publication" },
      { kind: "textarea", path: "adresse", label: "Adresse du siège" },
      { kind: "text", path: "date_maj_cgu", label: "Dernière MAJ CGU" },
      { kind: "text", path: "date_maj_confidentialite", label: "Dernière MAJ confidentialité" },
      { kind: "text", path: "date_maj_mentions", label: "Dernière MAJ mentions" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers de chemin (édition immuable par dot-path)                   */
/* ------------------------------------------------------------------ */

export function getPath(obj: unknown, path: string): unknown {
  if (path === "") return obj;
  return path.split(".").reduce<unknown>((acc, seg) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  if (path === "") return value as T;
  const segs = path.split(".");
  const clone = (node: unknown, depth: number): unknown => {
    if (depth === segs.length) return value;
    const seg = segs[depth];
    if (Array.isArray(node)) {
      const next = [...node];
      next[Number(seg)] = clone(node[Number(seg)], depth + 1);
      return next;
    }
    const base = (node ?? {}) as Record<string, unknown>;
    return { ...base, [seg]: clone(base[seg], depth + 1) };
  };
  return clone(obj, 0) as T;
}
