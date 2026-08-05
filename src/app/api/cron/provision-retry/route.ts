import { env } from "@/lib/env";
import { timingSafeEqualString } from "@/lib/crypto";
import { serviceClient } from "@/lib/supabase/service";
import { processDuePendingSignups } from "@/lib/billing/worker";
import { captureDueEntries } from "@/lib/billing/capture";
import { replayUnprocessedStripeEvents } from "@/lib/billing/stripe-replay";

/* ============================================================
   /api/cron/provision-retry — relance périodique du provisioning
   des dossiers payés (status='paid', next_retry_at échu), ET reprise
   des notifications Stripe restées sans effet — Stripe ne rejoue
   jamais rien pour nous, puisqu'on acquitte dès la journalisation.
   Auth : Bearer CRON_SECRET (comparaison à temps constant).
   Pas de verrou job_runs ici : le claim atomique du worker
   (paid → provisioning) suffit à exclure les doubles exécutions.
   GET accepté en plus du POST (crons simples type curl/uptime).
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false; // pas de secret configuré = route fermée
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && timingSafeEqualString(token, secret);
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!serviceClient()) {
    return Response.json({ error: "Base non configurée." }, { status: 503 });
  }
  /* Reprise des notifications Stripe EN PREMIER : c'est elle qui fait passer un
     dossier d'inscription à « payé ». La lancer avant le worker permet à un
     dossier débloqué d'être provisionné dans le même passage, au lieu d'attendre
     le suivant. */
  const stripe = await replayUnprocessedStripeEvents(10);
  const processed = await processDuePendingSignups(10);
  /* Rattrapage des encaissements : le TPE récurrent autorise sans prélever,
     et une demande de recouvrement a pu échouer (banque injoignable, refus
     transitoire). Sans ce passage, l'argent resterait indéfiniment autorisé
     mais jamais encaissé. */
  const captured = await captureDueEntries(20);
  return Response.json({ processed, captured, stripe });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
