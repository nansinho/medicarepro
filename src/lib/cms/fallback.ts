import type { ManagedPageContent } from "./sections.schema";
import { PAGE_HOME } from "@/data/content/home";
import { PAGE_FONCTIONNALITES } from "@/data/content/fonctionnalites";
import { PAGE_BILANS } from "@/data/content/bilans";
import { PAGE_SECURITE } from "@/data/content/securite";
import { PAGE_AVANTAGES } from "@/data/content/avantages";
import { PAGE_TARIFS } from "@/data/content/tarifs";
import { PAGE_CONTACT } from "@/data/content/contact";
import { PAGE_A_PROPOS } from "@/data/content/a-propos";
import {
  PAGE_CGU,
  PAGE_CGV,
  PAGE_MENTIONS,
  PAGE_CONFIDENTIALITE,
} from "@/data/content/legal";

/* ============================================================
   FALLBACK — le contenu embarqué du site.
   Rôle : (1) source du seed SQL, (2) filet de sécurité runtime :
   si Supabase est absent, injoignable, ou qu'une row ne valide
   plus le schéma zod, le fetcher retombe sur ces payloads → le
   site public ne casse JAMAIS.
   À terme (CMS stabilisé), cette couche pourra être retirée.
   ============================================================ */

export const FALLBACK_PAGES: Record<string, ManagedPageContent> = Object.fromEntries(
  [
    PAGE_HOME,
    PAGE_FONCTIONNALITES,
    PAGE_BILANS,
    PAGE_SECURITE,
    PAGE_AVANTAGES,
    PAGE_TARIFS,
    PAGE_CONTACT,
    PAGE_A_PROPOS,
    PAGE_CGU,
    PAGE_CGV,
    PAGE_MENTIONS,
    PAGE_CONFIDENTIALITE,
  ].map((page) => [page.slug, page as ManagedPageContent]),
);

export {
  TESTIMONIALS,
  TESTIMONIALS_RATING,
  PRICING_PLANS,
  PRICING_EXAMPLES,
  FEATURE_ITEMS,
} from "@/data/content/collections";
export { MENUS, SETTINGS, SEO_DEFAULTS } from "@/data/content/site";
export { FAQ_ITEMS } from "@/data/faq";
export { BLOG_POSTS } from "@/data/blogPosts";
