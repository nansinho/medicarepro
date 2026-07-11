import "server-only";
import { env } from "@/lib/env";

/* ============================================================
   Extraction de l'IP client derrière le(s) reverse-proxy(s).

   X-Forwarded-For est APPEND par chaque proxy : la seule entrée
   de confiance est celle ajoutée par NOTRE proxy (Traefik via
   Coolify = 1 hop). On lit donc la N-ième entrée en partant de
   la droite (N = TRUSTED_PROXY_HOPS) — tout ce qui précède est
   forgeable par le client et ne doit JAMAIS servir au rate-limit.
   ============================================================ */

export function clientIpFrom(headers: Headers): string {
  const hops = env().TRUSTED_PROXY_HOPS;
  const xff = headers.get("x-forwarded-for");

  if (xff && hops > 0) {
    const entries = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const candidate = entries[entries.length - hops];
    if (candidate) return candidate;
  }

  // Sans proxy (dev local) ou en-tête absent.
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
