import { unstable_cache } from "next/cache";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";

/* ============================================================
   Pages villes SEO local (lecture publique). Le contenu vit dans
   la table `cities` (colonnes content/faq/seo_*), PAS dans
   page_sections. RLS : anon ne voit que status='published'.
   ============================================================ */

export type CityContentSlots = {
  intro: string;
  contexte_local: string;
  benefices: string;
  meta_description: string;
  claims_to_verify: string[];
};

export type PublishedCity = {
  slug: string;
  name: string;
  nameLocative: string;
  region: string;
  deptName: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  content: CityContentSlots;
  faq: { q: string; a: string }[];
  publishedAt: string | null;
};

export type CityListItem = {
  slug: string;
  name: string;
  region: string;
};

function isSlots(value: unknown): value is CityContentSlots {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as CityContentSlots).intro === "string"
  );
}

async function fetchCity(slug: string): Promise<PublishedCity | null> {
  const sb = publicClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("cities")
    .select(
      "slug, name, name_locative, region, dept_name, seo_title, seo_description, h1, content, faq, published_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data || !isSlots(data.content)) return null;
  return {
    slug: data.slug,
    name: data.name,
    nameLocative: data.name_locative,
    region: data.region,
    deptName: data.dept_name,
    seoTitle: data.seo_title ?? `Logiciel podologue ${data.name_locative}`,
    seoDescription: data.seo_description ?? "",
    h1: data.h1 ?? `Logiciel de podologie ${data.name_locative}`,
    content: data.content as CityContentSlots,
    faq: Array.isArray(data.faq) ? (data.faq as { q: string; a: string }[]) : [],
    publishedAt: data.published_at,
  };
}

/** Une ville publiée par slug (cachée, tag cities). */
export async function getPublishedCity(slug: string): Promise<PublishedCity | null> {
  try {
    return await unstable_cache(() => fetchCity(slug), ["cms-city", slug], {
      tags: [TAGS.cities],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
  } catch {
    return null;
  }
}

async function fetchPublishedList(): Promise<CityListItem[]> {
  const sb = publicClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("cities")
    .select("slug, name, region")
    .eq("status", "published")
    .order("region")
    .order("name");
  if (error || !data) return [];
  return data as CityListItem[];
}

/** Toutes les villes publiées (hub + sitemap + generateStaticParams). */
export async function getPublishedCities(): Promise<CityListItem[]> {
  try {
    return await unstable_cache(fetchPublishedList, ["cms-cities-list"], {
      tags: [TAGS.cities],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
  } catch {
    return [];
  }
}

/** Villes voisines publiées (maillage interne « près de … »). */
export async function getNearbyCities(slug: string): Promise<CityListItem[]> {
  const sb = publicClient();
  if (!sb) return [];
  /* city_nearby(city_id → nearby_city_id) ; les deux villes doivent être
     publiées (RLS). Résolution en deux temps via les slugs. */
  const { data: self } = await sb
    .from("cities")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!self) return [];
  const { data: links } = await sb
    .from("city_nearby")
    .select("nearby_city_id, position")
    .eq("city_id", self.id)
    .order("position");
  const ids = (links ?? []).map((l) => l.nearby_city_id);
  if (ids.length === 0) return [];
  const { data: cities } = await sb
    .from("cities")
    .select("slug, name, region")
    .in("id", ids)
    .eq("status", "published");
  return (cities ?? []) as CityListItem[];
}
