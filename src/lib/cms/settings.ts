import { unstable_cache } from "next/cache";
import { SETTINGS } from "./fallback";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";

/* ============================================================
   Réglages du site (table site_settings, key/value jsonb).
   Le fallback embarqué (src/data/content/site.ts) fixe la forme
   canonique de chaque clé ; la valeur DB est prise telle quelle
   si elle a la même nature (objet/tableau), sinon fallback.
   ============================================================ */

export type Settings = typeof SETTINGS;
export type SettingKey = keyof Settings;

/** Même nature structurelle (objet vs tableau) que le fallback ? */
function sameShape(value: unknown, fallback: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(fallback)) return Array.isArray(value);
  return typeof value === "object" && !Array.isArray(value);
}

async function fetchAllSettings(): Promise<Record<string, unknown> | null> {
  const sb = publicClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("site_settings")
    .select("key, value")
    .eq("is_public", true);
  if (error || !data) return null;
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}

/** Tous les réglages publics, DB par-dessus fallback, clé par clé. */
export async function getSettings(): Promise<Settings> {
  try {
    const db = await unstable_cache(fetchAllSettings, ["cms-site-settings"], {
      tags: [TAGS.settings],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
    if (!db) return SETTINGS;
    const merged = { ...SETTINGS } as Record<string, unknown>;
    for (const key of Object.keys(SETTINGS) as SettingKey[]) {
      if (key in db && sameShape(db[key], SETTINGS[key])) {
        merged[key] = db[key];
      }
    }
    return merged as Settings;
  } catch {
    return SETTINGS;
  }
}

/** Un réglage précis (même garantie de forme que getSettings). */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<Settings[K]> {
  const all = await getSettings();
  return all[key];
}
