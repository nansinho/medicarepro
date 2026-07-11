import { unstable_cache } from "next/cache";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";

/* ============================================================
   Redirections gérées (table redirects). Résolution côté rendu :
   les routes qui font un notFound() (catch-all, /blog/[slug],
   pages villes) consultent d'abord la table — un renommage de
   slug reste servi en 301/308.
   NB : Next ne sert que 307/308 depuis redirect()/permanentRedirect
   → 301→308 et 302→307 (équivalent SEO, documenté dans l'admin).
   ============================================================ */

export type ManagedRedirect = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
};

async function fetchActiveRedirects(): Promise<ManagedRedirect[]> {
  const sb = publicClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("redirects")
    .select("id, from_path, to_path, status_code")
    .eq("is_active", true);
  if (error || !data) return [];
  return data as ManagedRedirect[];
}

/** Redirection active pour un chemin exact, ou null. */
export async function resolveRedirect(
  path: string,
): Promise<ManagedRedirect | null> {
  try {
    const list = await unstable_cache(fetchActiveRedirects, ["cms-redirects"], {
      tags: [TAGS.redirects],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
    const normalized =
      path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    return list.find((r) => r.from_path === normalized) ?? null;
  } catch {
    return null;
  }
}

/** La redirection est-elle « permanente » (301/308) ? */
export function isPermanent(redirect: ManagedRedirect): boolean {
  return redirect.status_code === 301 || redirect.status_code === 308;
}
