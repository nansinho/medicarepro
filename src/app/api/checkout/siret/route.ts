import { type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isValidSiret, extractEtablissement } from "@/lib/checkout/siret";

/* ============================================================
   GET /api/checkout/siret?siret=<14 chiffres> — auto-remplissage
   du tunnel d'inscription depuis l'annuaire public des entreprises
   (API Recherche d'entreprises — État, gratuite, sans clé).

   Proxy volontaire : pas d'appel direct navigateur → annuaire
   (CORS + on maîtrise le rythme). Service de CONFORT uniquement :
   toute erreur répond « indisponible », jamais bloquant pour
   l'inscription. Réponses : 200 { found, … } | 200 { found:false }
   | 422 | 429 | 503.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";

export async function GET(request: NextRequest) {
  const siret = (request.nextUrl.searchParams.get("siret") ?? "").trim();
  if (!isValidSiret(siret)) {
    return Response.json({ error: "SIRET invalide." }, { status: 422 });
  }

  // Garde de rythme par IP (l'annuaire de l'État limite à 7 req/s
  // globales) — en cas d'erreur RPC on laisse passer : simple confort.
  const supabase = serviceClient();
  if (supabase) {
    const ip = clientIpFrom(request.headers);
    const { data } = await supabase.rpc("hit_rate_limit", {
      p_bucket: `siret:${ip}`,
      p_limit: 30,
      p_window_seconds: 3600,
    });
    if (data === false) {
      return Response.json({ error: "Trop de requêtes." }, { status: 429 });
    }
  }

  try {
    const res = await fetch(
      `${SEARCH_URL}?q=${siret}&page=1&per_page=1`,
      { signal: AbortSignal.timeout(4_000), cache: "no-store" },
    );
    if (!res.ok) {
      return Response.json(
        { error: "Annuaire momentanément indisponible." },
        { status: 503 },
      );
    }
    const result = extractEtablissement(await res.json(), siret);
    return Response.json(result, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch {
    return Response.json(
      { error: "Annuaire momentanément indisponible." },
      { status: 503 },
    );
  }
}
