import "server-only";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   Écritures de télémétrie SEO (service-role, RPC 0018) —
   best-effort : appelées via after(), jamais bloquantes, jamais
   d'erreur remontée au rendu.
   ============================================================ */

export async function recordRedirectHit(id: string): Promise<void> {
  try {
    const service = serviceClient();
    if (!service) return;
    await service.rpc("record_redirect_hit", { p_id: id });
  } catch {
    /* best-effort */
  }
}

export async function recordNotFound(
  path: string,
  referer: string | null,
): Promise<void> {
  try {
    const service = serviceClient();
    if (!service) return;
    await service.rpc("record_not_found", {
      p_path: path,
      p_referer: referer,
    });
  } catch {
    /* best-effort */
  }
}
