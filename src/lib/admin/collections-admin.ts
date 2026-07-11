import { z, type ZodObject } from "zod";
import {
  ImageRefSchema,
  IconKeySchema,
  MockupKindSchema,
} from "@/lib/cms/sections.schema";
import { TAGS } from "@/lib/cms/tags";

/* ============================================================
   Collections éditables du CMS : configuration partagée entre
   les formulaires (client) et les actions (serveur).
   RÈGLE : une row invalide fait retomber TOUTE la collection
   publique sur le fallback embarqué — la validation stricte à
   l'écriture (schema) est la seule protection.
   `toForm`/`toRow` traduisent DB ↔ formulaire (ex. avatar
   media_id+path ↔ widget ImageRef).
   ============================================================ */

export type CollectionKey =
  | "testimonials"
  | "faq_items"
  | "pricing_plans"
  | "pricing_examples"
  | "feature_items"
  | "menus";

export type CollectionConfig = {
  key: CollectionKey;
  table: string;
  title: string;
  description: string;
  /** Tags à invalider après écriture. */
  tags: string[];
  /** Schéma du FORMULAIRE (validé strictement avant écriture). */
  schema: ZodObject;
  /** Champ affiché comme intitulé de row dans la liste. */
  summaryField: string;
  hasPublished: boolean;
  hasPosition: boolean;
  /** Colonne identifiante ("id" par défaut ; "key" pour menus). */
  idColumn?: string;
  /** Rows fixes : édition seule, ni création ni suppression (menus). */
  fixedRows?: boolean;
  toForm: (row: Record<string, unknown>) => Record<string, unknown>;
  toRow: (values: Record<string, unknown>) => Record<string, unknown>;
};

const identity = (v: Record<string, unknown>) => ({ ...v });

export const COLLECTIONS_ADMIN: Record<CollectionKey, CollectionConfig> = {
  testimonials: {
    key: "testimonials",
    table: "testimonials",
    title: "Témoignages",
    description: "Avis affichés sur l'accueil et les pages du site.",
    tags: [TAGS.testimonials],
    schema: z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      quote: z.string().min(1),
      avatar: ImageRefSchema,
      rating: z.number().min(1).max(5),
    }),
    summaryField: "name",
    hasPublished: true,
    hasPosition: true,
    toForm: (row) => ({
      name: row.name ?? "",
      role: row.role ?? "",
      quote: row.quote ?? "",
      avatar: {
        mediaId: (row.avatar_media_id as string | null) ?? null,
        path: (row.avatar_path as string) ?? "",
        alt: (row.name as string) ?? "",
      },
      rating: (row.rating as number) ?? 5,
    }),
    toRow: (values) => {
      const avatar = values.avatar as {
        mediaId: string | null;
        path: string;
      };
      return {
        name: values.name,
        role: values.role,
        quote: values.quote,
        avatar_media_id: avatar?.mediaId ?? null,
        avatar_path: avatar?.path ?? "",
        rating: values.rating,
      };
    },
  },

  faq_items: {
    key: "faq_items",
    table: "faq_items",
    title: "FAQ",
    description: "Questions / réponses du site (contexte global ou par page).",
    tags: [TAGS.faq],
    schema: z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      context: z.enum(["global", "pricing", "security", "city"]),
    }),
    summaryField: "question",
    hasPublished: true,
    hasPosition: true,
    toForm: (row) => ({
      question: row.question ?? "",
      answer: row.answer ?? "",
      context: row.context ?? "global",
    }),
    toRow: identity,
  },

  pricing_plans: {
    key: "pricing_plans",
    table: "pricing_plans",
    title: "Formules",
    description: "Les formules d'abonnement (mensuelle / annuelle).",
    tags: [TAGS.pricing],
    schema: z.object({
      plan_key: z.enum(["monthly", "annual"]),
      name: z.string().min(1),
      sub: z.string().min(1),
      price: z.number().min(0),
      unit: z.string().min(1),
      secondary: z.string().min(1),
      featured: z.boolean(),
      badge: z.string().optional(),
      cta_label: z.string().min(1),
      features: z.array(
        z.object({
          label: z.string().min(1),
          highlight: z.boolean().optional(),
        }),
      ),
    }),
    summaryField: "name",
    hasPublished: true,
    hasPosition: true,
    toForm: (row) => ({ ...row, badge: row.badge ?? "" }),
    toRow: (values) => ({ ...values, badge: values.badge || null }),
  },

  pricing_examples: {
    key: "pricing_examples",
    table: "pricing_examples",
    title: "Exemples de tarifs",
    description: "Le comparatif mensuel / annuel par configuration.",
    tags: [TAGS.pricing],
    schema: z.object({
      config: z.string().min(1),
      monthly: z.number().min(0),
      yearly: z.number().min(0),
    }),
    summaryField: "config",
    hasPublished: false,
    hasPosition: true,
    toForm: identity,
    toRow: identity,
  },

  feature_items: {
    key: "feature_items",
    table: "feature_items",
    title: "Fonctionnalités",
    description:
      "Les cartes fonctionnalités (accueil, page fonctionnalités) et bilans.",
    tags: [TAGS.features],
    schema: z.object({
      collection: z.enum(["features", "bilans"]),
      icon: IconKeySchema,
      kicker: z.string().min(1),
      title: z.string().min(1),
      text: z.string().min(1),
      points: z.array(z.string().min(1)),
      mockup: MockupKindSchema,
      href: z.string().optional(),
      href_label: z.string().optional(),
    }),
    summaryField: "title",
    hasPublished: true,
    hasPosition: true,
    toForm: (row) => ({
      ...row,
      href: row.href ?? "",
      href_label: row.href_label ?? "",
      points: Array.isArray(row.points) ? row.points : [],
    }),
    toRow: (values) => ({
      ...values,
      href: values.href || null,
      href_label: values.href_label || null,
    }),
  },

  menus: {
    key: "menus",
    table: "menus",
    title: "Menus",
    description:
      "Navigation du header et colonnes du pied de page (structure avancée).",
    tags: [TAGS.menus],
    schema: z.object({
      key: z.enum(["header", "footer_product", "footer_resources"]),
      items: z.any(),
    }),
    summaryField: "key",
    hasPublished: false,
    hasPosition: false,
    idColumn: "key",
    fixedRows: true,
    toForm: identity,
    toRow: identity,
  },
};

export const COLLECTION_KEYS = Object.keys(
  COLLECTIONS_ADMIN,
) as CollectionKey[];
