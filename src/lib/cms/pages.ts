import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import {
  SectionContentSchema,
  type SectionContent,
  type SectionContentOf,
  type SectionType,
} from "./sections.schema";
import { FALLBACK_PAGES } from "./fallback";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";
import { serverClient } from "@/lib/supabase/server";

/* ============================================================
   Lecture des sections d'une page gérée.
   Garantie : pour chaque slot du fallback, le résultat contient
   une section DU MÊME TYPE (row DB valide, sinon fallback) → une
   page ne peut jamais casser à cause d'une donnée invalide.
   - Public : client anon sans cookies, cachable (unstable_cache).
   - Preview (draftMode) : lecture directe non cachée, brouillon
     prioritaire (coalesce draft/content), via la session staff.
   ============================================================ */

export type PageSections = Record<string, SectionContent>;

type SectionRow = {
  section_key: string | null;
  type: string;
  content: unknown;
  draft?: unknown;
};

/** Slots du fallback, normalisés par le schéma (defaults appliqués). */
function fallbackSections(slug: string): PageSections {
  const page = FALLBACK_PAGES[slug];
  if (!page) throw new Error(`Page gérée inconnue : « ${slug} »`);
  const out: PageSections = {};
  for (const slot of page.sections) {
    out[slot.key] = SectionContentSchema.parse(slot.content);
  }
  return out;
}

/** Applique les rows DB valides par-dessus le fallback (types identiques). */
function mergeRows(base: PageSections, rows: SectionRow[]): PageSections {
  const out = { ...base };
  for (const row of rows) {
    if (!row.section_key) continue;
    const parsed = SectionContentSchema.safeParse(row.content);
    if (!parsed.success) continue; // row invalide → on garde le fallback
    const expected = out[row.section_key];
    if (expected && expected.type !== parsed.data.type) continue;
    out[row.section_key] = parsed.data;
  }
  return out;
}

async function fetchPublishedRows(slug: string): Promise<SectionRow[] | null> {
  const sb = publicClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("pages")
    .select("slug, status, page_sections(section_key, type, content)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return (data.page_sections as SectionRow[]) ?? null;
}

/** Sections publiées d'une page gérée (cachées, fallback garanti). */
export async function getPageSections(slug: string): Promise<PageSections> {
  const base = fallbackSections(slug);

  /* Preview admin : brouillon prioritaire, jamais caché. */
  try {
    const { isEnabled } = await draftMode();
    if (isEnabled) {
      const sb = await serverClient();
      if (sb) {
        const { data } = await sb
          .from("pages")
          .select("slug, page_sections(section_key, type, content, draft)")
          .eq("slug", slug)
          .maybeSingle();
        const rows = ((data?.page_sections as SectionRow[]) ?? []).map(
          (row) => ({ ...row, content: row.draft ?? row.content }),
        );
        return mergeRows(base, rows);
      }
    }
  } catch {
    /* draftMode() indisponible hors requête (build) : lecture publique. */
  }

  try {
    const rows = await unstable_cache(
      () => fetchPublishedRows(slug),
      ["cms-page-sections", slug],
      {
        tags: [TAGS.page(slug), TAGS.pages],
        revalidate: CACHE_SAFETY_REVALIDATE,
      },
    )();
    if (!rows) return base;
    return mergeRows(base, rows);
  } catch {
    return base;
  }
}

/** Extrait un slot typé. `getPageSections` garantissant la complétude des
 *  slots du fallback, un échec ici est un bug de câblage (clé/type faux). */
export function pick<T extends SectionType>(
  sections: PageSections,
  key: string,
  type: T,
): SectionContentOf<T> {
  const section = sections[key];
  if (!section || section.type !== type) {
    throw new Error(`Slot « ${key} » (${type}) introuvable`);
  }
  return section as SectionContentOf<T>;
}
