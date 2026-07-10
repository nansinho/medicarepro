import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Client PUBLIC (clé anon, SANS cookies).
   C'est le SEUL client utilisable dans un scope `unstable_cache`
   (cookies() y est interdit). La RLS garantit qu'il ne voit que
   le contenu publié — exactement ce que le cache public doit
   contenir.
   Retourne null si Supabase n'est pas configuré : les fetchers
   CMS retombent alors sur le contenu embarqué.
   ============================================================ */

let cached: SupabaseClient | null | undefined;

export function publicClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
