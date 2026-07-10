import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  TestimonialSchema,
  PricingPlanSchema,
  PricingExampleSchema,
  FeatureItemSchema,
  FaqItemSchema,
  type Testimonial,
  type PricingPlan,
  type PricingExample,
  type FeatureItem,
  type FaqItem,
} from "./sections.schema";
import {
  TESTIMONIALS,
  PRICING_PLANS,
  PRICING_EXAMPLES,
  FEATURE_ITEMS,
  FAQ_ITEMS,
  MENUS,
} from "./fallback";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";
import type { MenuItem } from "@/data/content/site";

/* ============================================================
   Collections réutilisables (témoignages, tarifs, features, FAQ,
   menus). Chaque fetcher : lecture anon cachée → mapping vers la
   forme TS canonique → validation zod ; au moindre pépin, retour
   du fallback embarqué.
   ============================================================ */

/** Fabrique un fetcher caché avec validation zod + fallback. */
function collection<T>(opts: {
  cacheKey: string;
  tag: string;
  fallback: T;
  query: () => Promise<unknown[] | null>;
  map: (row: Record<string, unknown>) => unknown;
  schema: z.ZodType;
}): () => Promise<T> {
  return async () => {
    const sb = publicClient();
    if (!sb) return opts.fallback;
    try {
      const rows = await unstable_cache(opts.query, [opts.cacheKey], {
        tags: [opts.tag],
        revalidate: CACHE_SAFETY_REVALIDATE,
      })();
      if (!rows || rows.length === 0) return opts.fallback;
      const mapped = rows.map((row) =>
        opts.map(row as Record<string, unknown>),
      );
      const parsed = z.array(opts.schema).safeParse(mapped);
      return parsed.success ? (parsed.data as T) : opts.fallback;
    } catch {
      return opts.fallback;
    }
  };
}

export const getTestimonials = collection<Testimonial[]>({
  cacheKey: "cms-testimonials",
  tag: TAGS.testimonials,
  fallback: TESTIMONIALS,
  query: async () => {
    const { data } = await publicClient()!
      .from("testimonials")
      .select("name, role, avatar_path, quote")
      .eq("published", true)
      .order("position");
    return data;
  },
  map: (r) => ({
    name: r.name,
    role: r.role,
    avatar: { mediaId: null, path: r.avatar_path, alt: r.name },
    quote: r.quote,
  }),
  schema: TestimonialSchema,
});

export const getPricingPlans = collection<PricingPlan[]>({
  cacheKey: "cms-pricing-plans",
  tag: TAGS.pricing,
  fallback: PRICING_PLANS,
  query: async () => {
    const { data } = await publicClient()!
      .from("pricing_plans")
      .select(
        "plan_key, name, sub, price, unit, secondary, featured, badge, cta_label, features",
      )
      .eq("published", true)
      .order("position");
    return data;
  },
  map: (r) => ({
    planKey: r.plan_key,
    name: r.name,
    sub: r.sub,
    price: Number(r.price),
    unit: r.unit,
    secondary: r.secondary,
    featured: r.featured === true ? true : undefined,
    badge: r.badge ?? undefined,
    features: r.features,
    cta: r.cta_label,
  }),
  schema: PricingPlanSchema,
});

export const getPricingExamples = collection<PricingExample[]>({
  cacheKey: "cms-pricing-examples",
  tag: TAGS.pricing,
  fallback: PRICING_EXAMPLES,
  query: async () => {
    const { data } = await publicClient()!
      .from("pricing_examples")
      .select("config, monthly, yearly")
      .order("position");
    return data;
  },
  map: (r) => ({
    config: r.config,
    monthly: Number(r.monthly),
    yearly: Number(r.yearly),
  }),
  schema: PricingExampleSchema,
});

async function fetchFeatureItems(): Promise<FeatureItem[]> {
  const getAll = collection<FeatureItem[]>({
    cacheKey: "cms-feature-items",
    tag: TAGS.features,
    fallback: FEATURE_ITEMS as FeatureItem[],
    query: async () => {
      const { data } = await publicClient()!
        .from("feature_items")
        .select(
          "collection, position, icon, kicker, title, text, points, mockup, href, href_label",
        )
        .eq("published", true)
        .order("position");
      return data;
    },
    map: (r) => ({
      collection: r.collection,
      position: r.position,
      icon: r.icon,
      kicker: r.kicker,
      title: r.title,
      text: r.text,
      points: r.points,
      mockup: r.mockup,
      href: r.href ?? undefined,
      hrefLabel: r.href_label ?? undefined,
    }),
    schema: FeatureItemSchema,
  });
  return getAll();
}

/** Les 10 features ou les 3 bilans phares, dans l'ordre. */
export async function getFeatureItems(
  which: "features" | "bilans",
): Promise<FeatureItem[]> {
  const all = await fetchFeatureItems();
  return all.filter((item) => item.collection === which);
}

export const getFaqItems = collection<FaqItem[]>({
  cacheKey: "cms-faq-items",
  tag: TAGS.faq,
  fallback: FAQ_ITEMS,
  query: async () => {
    const { data } = await publicClient()!
      .from("faq_items")
      .select("question, answer")
      .eq("published", true)
      .order("position");
    return data;
  },
  map: (r) => ({ q: r.question, a: r.answer }),
  schema: FaqItemSchema,
});

/* ---------------- Menus (header / footer) ---------------- */

const MenuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    label: z.string(),
    href: z.string(),
    children: z.array(MenuItemSchema).optional(),
  }),
);

export async function getMenu(key: keyof typeof MENUS): Promise<MenuItem[]> {
  const fallback = MENUS[key];
  const sb = publicClient();
  if (!sb) return fallback;
  try {
    const value = await unstable_cache(
      async () => {
        const { data } = await publicClient()!
          .from("menus")
          .select("items")
          .eq("key", key)
          .maybeSingle();
        return data?.items ?? null;
      },
      ["cms-menu", key],
      { tags: [TAGS.menus], revalidate: CACHE_SAFETY_REVALIDATE },
    )();
    if (!value) return fallback;
    const parsed = z.array(MenuItemSchema).safeParse(value);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}
