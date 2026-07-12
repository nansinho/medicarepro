import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { timingSafeEqualString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { hasAi } from "@/lib/ai/anthropic";
import { processCityGeneration } from "@/lib/ai/city-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* ============================================================
   Worker de génération IA. Vide la file `ai_generations`
   (kind='city_page') : réclame atomiquement (claim_ai_generation,
   FOR UPDATE SKIP LOCKED), traite, recommence — dans une limite de
   temps. À planifier côté Coolify (toutes les 5 min) :
     curl -H "Authorization: Bearer $CRON_SECRET" \
       https://medicarepro.fr/api/jobs/ai-generate
   Déclenchable aussi manuellement depuis l'admin (même secret).
   ============================================================ */

const TIME_BUDGET_MS = 240_000; // 4 min, sous maxDuration
const MAX_PER_RUN = 8;

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !timingSafeEqualString(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasAi()) {
    return NextResponse.json(
      { error: "ia_non_configuree", detail: "ANTHROPIC_API_KEY / ANTHROPIC_MODEL manquants" },
      { status: 503 },
    );
  }

  const service = serviceClient();
  if (!service) {
    return NextResponse.json({ error: "supabase_non_configure" }, { status: 503 });
  }

  const started = Date.now();
  const processed: { id: string; ok: boolean; message: string }[] = [];

  while (Date.now() - started < TIME_BUDGET_MS && processed.length < MAX_PER_RUN) {
    /* Réclame la plus ancienne génération queued (ou une running bloquée). */
    const { data: claimed, error } = await service.rpc("claim_ai_generation");
    if (error) {
      return NextResponse.json({ error: error.message, processed }, { status: 500 });
    }
    const generation = claimed as { id: string; kind: string; subject_id: string | null } | null;
    if (!generation || !generation.id) break; // file vide

    if (generation.kind !== "city_page") {
      /* Kinds non gérés par ce worker (article/meta) : on ne les bloque pas. */
      await service
        .from("ai_generations")
        .update({ status: "failed", error: `kind ${generation.kind} non pris en charge` })
        .eq("id", generation.id);
      processed.push({ id: generation.id, ok: false, message: "kind non géré" });
      continue;
    }

    const result = await processCityGeneration(service, generation);
    processed.push({ id: generation.id, ...result });
  }

  return NextResponse.json({ processed: processed.length, results: processed });
}

export { handle as GET, handle as POST };
