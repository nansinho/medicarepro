import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Client SERVICE ROLE — contourne la RLS. Serveur uniquement
   (import "server-only" fait échouer tout import client).
   Usages autorisés (liste fermée, cf. plan §2) : insert contact/
   newsletter, cron (publication programmée, IA, GSC), audit_log,
   opérations auth.admin (invitations, rôles).
   ============================================================ */

let cached: SupabaseClient | null | undefined;

export function serviceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
