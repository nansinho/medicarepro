import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";
import { serverClient } from "@/lib/supabase/server";
import { isLocalData, type CityLocalData } from "./city-data";

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
  deptCode: string;
  deptName: string;
  /** Chiffres sourcés affichés sur la page (null : ville sans données). */
  localData: CityLocalData | null;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  content: CityContentSlots;
  faq: { q: string; a: string }[];
  publishedAt: string | null;
  /** Dernière modification (dateModified des données structurées). */
  updatedAt: string;
};

export type CityListItem = {
  slug: string;
  name: string;
  region: string;
  /** Dernière modification (lastmod du plan du site). */
  updatedAt: string;
};

function isSlots(value: unknown): value is CityContentSlots {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as CityContentSlots).intro === "string"
  );
}

const CITY_PAGE_COLUMNS =
  "slug, name, name_locative, region, dept_code, dept_name, local_data, seo_title, seo_description, h1, content, faq, published_at, updated_at";

/** Ville publiée ; en aperçu (staff, draftMode) : toute ville rédigée non archivée. */
async function fetchCity(slug: string, preview = false): Promise<PublishedCity | null> {
  const sb = preview ? await serverClient() : publicClient();
  if (!sb) return null;
  let query = sb.from("cities").select(CITY_PAGE_COLUMNS).eq("slug", slug);
  query = preview ? query.neq("status", "archived") : query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error || !data || !isSlots(data.content)) return null;
  return {
    slug: data.slug,
    name: data.name,
    nameLocative: data.name_locative,
    region: data.region,
    deptCode: data.dept_code,
    deptName: data.dept_name,
    localData: isLocalData(data.local_data) ? data.local_data : null,
    seoTitle: data.seo_title ?? `Logiciel podologue ${data.name_locative}`,
    seoDescription: data.seo_description ?? "",
    h1: data.h1 ?? `Logiciel de podologie ${data.name_locative}`,
    content: data.content as CityContentSlots,
    faq: Array.isArray(data.faq) ? (data.faq as { q: string; a: string }[]) : [],
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  };
}

/** Une ville publiée par slug (cachée, tag cities). En aperçu staff
 *  (draftMode) : aussi les villes validées ou à revoir, jamais cachées. */
export async function getPublishedCity(slug: string): Promise<PublishedCity | null> {
  try {
    if ((await draftMode()).isEnabled) return await fetchCity(slug, true);
  } catch {
    /* draftMode() indisponible hors requête (build) : lecture publique. */
  }
  try {
    return await unstable_cache(() => fetchCity(slug), ["cms-city", slug], {
      tags: [TAGS.cities],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
  } catch {
    return null;
  }
}

type ListRow = { slug: string; name: string; region: string; updated_at: string };
const toListItem = (r: ListRow): CityListItem => ({ slug: r.slug, name: r.name, region: r.region, updatedAt: r.updated_at });

/* Paginé : la base plafonne une réponse à 1 000 lignes. */
async function fetchPublishedList(): Promise<CityListItem[]> {
  const sb = publicClient();
  if (!sb) return [];
  const out: CityListItem[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("cities")
      .select("slug, name, region, updated_at")
      .eq("status", "published")
      .order("region")
      .order("name")
      .order("slug")
      .range(from, from + 999);
    if (error || !data) return out;
    out.push(...(data as ListRow[]).map(toListItem));
    if (data.length < 1000) return out;
  }
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
    .select("id, slug, name, region, updated_at")
    .in("id", ids)
    .eq("status", "published");
  /* Du plus proche au plus éloigné (ordre de city_nearby). */
  const rank = new Map(ids.map((id, i) => [id, i]));
  return ((cities ?? []) as (ListRow & { id: string })[])
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map(toListItem);
}
