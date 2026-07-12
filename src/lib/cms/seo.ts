import type { Metadata, MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { SEO_DEFAULTS } from "./fallback";
import { getPosts } from "./posts";
import { getPublishedCities } from "./cities";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";
import type { SeoDefault } from "@/data/content/site";

/* ============================================================
   SEO par route : les valeurs codées (SEO_DEFAULTS) servent de
   défauts, la table seo_meta les surcharge champ par champ.
   `pageMetadata(path)` remplace les `export const metadata` des
   pages (via generateMetadata). Le sitemap est DB-driven avec
   lastmod réels.
   ============================================================ */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://medicarepro.fr";

export type ResolvedSeo = SeoDefault & {
  noindex?: boolean;
  sitemapInclude?: boolean;
  updatedAt?: string;
};

type SeoRow = {
  path: string;
  title: string | null;
  title_absolute: boolean | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean | null;
  sitemap_include: boolean | null;
  sitemap_priority: number | string | null;
  sitemap_changefreq: string | null;
  updated_at: string | null;
};

const CHANGEFREQS = ["weekly", "monthly", "yearly"] as const;

async function fetchSeoRows(): Promise<Record<string, SeoRow> | null> {
  const sb = publicClient();
  if (!sb) return null;
  const { data, error } = await sb.from("seo_meta").select(
    "path, title, title_absolute, description, canonical, noindex, sitemap_include, sitemap_priority, sitemap_changefreq, updated_at",
  );
  if (error || !data) return null;
  return Object.fromEntries(data.map((row) => [row.path, row as SeoRow]));
}

async function getSeoRows(): Promise<Record<string, SeoRow>> {
  const sb = publicClient();
  if (!sb) return {};
  try {
    return (
      (await unstable_cache(fetchSeoRows, ["cms-seo-meta"], {
        tags: [TAGS.seo],
        revalidate: CACHE_SAFETY_REVALIDATE,
      })()) ?? {}
    );
  } catch {
    return {};
  }
}

/** SEO résolu d'une route : défauts codés + surcharges seo_meta. */
export async function getSeo(path: string): Promise<ResolvedSeo> {
  const defaults = (SEO_DEFAULTS as Record<string, SeoDefault>)[path];
  if (!defaults) throw new Error(`SEO_DEFAULTS manquant pour « ${path} »`);
  const row = (await getSeoRows())[path];
  if (!row) return defaults;

  const changefreq = CHANGEFREQS.includes(
    row.sitemap_changefreq as (typeof CHANGEFREQS)[number],
  )
    ? (row.sitemap_changefreq as SeoDefault["sitemapChangefreq"])
    : defaults.sitemapChangefreq;

  return {
    title: row.title ?? defaults.title,
    titleAbsolute: row.title_absolute ?? defaults.titleAbsolute,
    description: row.description ?? defaults.description,
    canonical: row.canonical ?? defaults.canonical,
    sitemapPriority:
      row.sitemap_priority !== null && row.sitemap_priority !== undefined
        ? Number(row.sitemap_priority)
        : defaults.sitemapPriority,
    sitemapChangefreq: changefreq,
    noindex: row.noindex ?? undefined,
    sitemapInclude: row.sitemap_include ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** Metadata Next d'une route gérée (à appeler dans generateMetadata). */
export async function pageMetadata(path: string): Promise<Metadata> {
  const seo = await getSeo(path);
  return {
    title: seo.titleAbsolute ? { absolute: seo.title } : seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    ...(seo.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Entrées du sitemap : routes gérées (surcharges + lastmod DB réels)
 *  + articles publiés + pages villes publiées + le hub. */
export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const rows = await getSeoRows();
  const buildDate = new Date();

  const pages: MetadataRoute.Sitemap = [];
  for (const path of Object.keys(SEO_DEFAULTS)) {
    const seo = await getSeo(path);
    if (seo.sitemapInclude === false || seo.noindex) continue;
    pages.push({
      url: `${SITE_URL}${path}`,
      lastModified: seo.updatedAt ? new Date(seo.updatedAt) : buildDate,
      changeFrequency: seo.sitemapChangefreq,
      priority: seo.sitemapPriority,
    });
  }

  const posts = (await getPosts()).map((post) => {
    const row = rows[`/blog/${post.slug}`];
    return {
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: row?.updated_at
        ? new Date(row.updated_at)
        : new Date(post.date),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    };
  });

  /* Pages villes SEO local publiées + le hub. */
  const cities = await getPublishedCities();
  const cityEntries: MetadataRoute.Sitemap =
    cities.length > 0
      ? [
          {
            url: `${SITE_URL}/logiciel-podologue`,
            lastModified: buildDate,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          },
          ...cities.map((city) => ({
            url: `${SITE_URL}/logiciel-podologue/${city.slug}`,
            lastModified: buildDate,
            changeFrequency: "monthly" as const,
            priority: 0.5,
          })),
        ]
      : [];

  return [...pages, ...posts, ...cityEntries];
}
