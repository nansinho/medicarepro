import { type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { suggestSiret } from "@/lib/checkout/annuaire";

/* ============================================================
   GET /api/checkout/siret/suggest?prefix=<7 à 13 chiffres> —
   guidage de saisie du SIRET.

   À chaque chiffre tapé, l'écran nomme les établissements encore
   possibles : dix à sept chiffres, un seul à huit, puis les
   établissements de l'entreprise. Voir `annuaire.ts` pour la
   mécanique (l'annuaire public ne cherche pas par préfixe, c'est
   la clé de Luhn qui fabrique les candidats).

   Le proxy est volontaire : le navigateur ne parle jamais à
   l'annuaire directement, sinon le quota de l'État serait consommé
   sans cache ni cadence, et chaque frappe partirait en clair chez
   un tiers avec l'adresse IP du praticien.
   Réponses : 200 { status, items, … } | 422.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const prefix = (request.nextUrl.searchParams.get("prefix") ?? "").trim();
  if (!/^\d{1,13}$/.test(prefix)) {
    return Response.json({ error: "Préfixe invalide." }, { status: 422 });
  }

  /* Une inscription normale consomme quelques requêtes (les chiffres
     suivants sont filtrés dans le navigateur, sans rien redemander).
     Ce plafond n'arrête donc qu'un martèlement, et il rend alors
     « indisponible » : la saisie manuelle du SIRET reste possible. */
  const supabase = serviceClient();
  if (supabase) {
    const ip = clientIpFrom(request.headers);
    const { data } = await supabase.rpc("hit_rate_limit", {
      p_bucket: `siret-suggest:${ip}`,
      p_limit: 90,
      p_window_seconds: 3600,
    });
    if (data === false) {
      return Response.json({ prefix, status: "unavailable", items: [] });
    }
  }

  const reply = await suggestSiret(prefix);
  return Response.json(reply, {
    headers: { "cache-control": "private, max-age=120" },
  });
}
