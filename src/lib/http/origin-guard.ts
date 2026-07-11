import "server-only";
import { env } from "@/lib/env";

/* ============================================================
   Garde anti-cross-origin des POST publics (checkout, retry…).

   Pas de CORS permissif : on exige un POST JSON émis par NOS
   pages. Deux signaux, dans l'ordre :
   1. Sec-Fetch-Site (navigateurs modernes) : same-origin exigé.
   2. À défaut, Origin comparé à NEXT_PUBLIC_SITE_URL.
   Un client sans aucun des deux (curl, script) est refusé —
   ces routes ne servent que le tunnel navigateur.
   ============================================================ */

export function isSameOriginJsonPost(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const site = new URL(env().NEXT_PUBLIC_SITE_URL);
      const from = new URL(origin);
      return from.host === site.host;
    } catch {
      return false;
    }
  }

  return false;
}
