/* ============================================================
   Tags de cache — schéma de nommage UNIQUE pour tout le CMS.
   Chaque server action de publication appelle revalidateTag()
   sur les tags touchés. Filet de sécurité : chaque unstable_cache
   pose aussi `revalidate: 3600`.
   ============================================================ */

export const TAGS = {
  /** Une page gérée/composée précise. */
  page: (slug: string) => `page:${slug}`,
  /** Toutes les pages (création/suppression, sitemap). */
  pages: "pages",

  post: (slug: string) => `post:${slug}`,
  posts: "posts",

  testimonials: "testimonials",
  faq: "faq",
  pricing: "pricing",
  features: "features",
  menus: "menus",
  settings: "settings",
  seo: "seo",
  redirects: "redirects",
  cities: "cities",
  sitemap: "sitemap",
} as const;

/** Durée du filet de sécurité (s) posé sur chaque unstable_cache. */
export const CACHE_SAFETY_REVALIDATE = 3600;
