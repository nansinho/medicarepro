import { type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isValidSiret } from "@/lib/checkout/siret";
import { verifySiret } from "@/lib/checkout/annuaire";

/* ============================================================
   GET /api/checkout/siret?siret=<14 chiffres> — VERDICT sur un
   établissement, et pré-remplissage du tunnel d'inscription.

   Ce n'est plus un service de confort : depuis le 06/08/2026 le
   SIRET conditionne l'entrée. Un établissement inconnu ou fermé au
   répertoire SIRENE fait refuser l'inscription (le contrôle qui fait
   foi reste celui de POST /api/checkout, ici on ne fait que le dire
   assez tôt pour que personne ne saisisse un dossier pour rien).

   La panne, elle, ne bloque personne : `unavailable` laisse passer.
   Réponses : 200 { status, found, … } | 422 | 429.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const siret = (request.nextUrl.searchParams.get("siret") ?? "").trim();
  if (!isValidSiret(siret)) {
    return Response.json(
      { status: "invalid", found: false, error: "SIRET invalide." },
      { status: 422 },
    );
  }

  /* Garde de rythme par IP. Dépassée, on répond « indisponible » plutôt
     que 429 : un compteur atteint est un incident chez nous, il ne doit
     pas se transformer en refus d'inscription pour le praticien. */
  const supabase = serviceClient();
  if (supabase) {
    const ip = clientIpFrom(request.headers);
    const { data } = await supabase.rpc("hit_rate_limit", {
      p_bucket: `siret:${ip}`,
      p_limit: 60,
      p_window_seconds: 3600,
    });
    if (data === false) {
      return Response.json({ status: "unavailable", found: false });
    }
  }

  const verdict = await verifySiret(siret);
  return Response.json(
    {
      status: verdict.status,
      found: verdict.status === "active" || verdict.status === "closed",
      ...(verdict.data ?? {}),
    },
    { headers: { "cache-control": "private, max-age=300" } },
  );
}
