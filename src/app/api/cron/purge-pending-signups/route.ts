import { env } from "@/lib/env";
import { timingSafeEqualString } from "@/lib/crypto";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   /api/cron/purge-pending-signups — hygiène RGPD du tunnel.
   Verrouillé par job_runs (index unique partiel : un seul run
   'running' par job). Purges, dans l'ordre :
   1. payment_pending > 24 h  → 'abandoned' + secrets effacés ;
   2. abandoned jamais payés > 30 j → DELETE ;
   3. abandoned payés (remboursés) > 90 j → anonymisation
      (cabinet/user_info vidés, IP/UA effacés) — la ligne reste
      pour la traçabilité de chaîne, billing_ledger porte la
      pièce comptable ;
   4. provisioned > 90 j → même anonymisation (subscriptions
      porte déjà tout le nécessaire) ;
   5. ipn_events > 13 mois → DELETE.
   Auth : Bearer CRON_SECRET (comparaison à temps constant).
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_NAME = "purge-pending-signups";

function isAuthorized(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false; // pas de secret configuré = route fermée
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && timingSafeEqualString(token, secret);
}

type PurgeResult = {
  abandoned: number;
  deleted: number;
  consentsDeleted?: number;
  anonymized_paid: number;
  anonymized_provisioned: number;
  ipn_deleted: number;
};

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  const supabase = serviceClient();
  if (!supabase) {
    return Response.json({ error: "Base non configurée." }, { status: 503 });
  }

  // Verrou : l'index unique partiel de job_runs refuse un 2e run 'running'.
  const { data: run, error: lockError } = await supabase
    .from("job_runs")
    .insert({ job_name: JOB_NAME, triggered_by: "cron" })
    .select("id")
    .single();
  if (lockError || !run) {
    if (lockError?.code === "23505") {
      return Response.json({ error: "Purge déjà en cours." }, { status: 409 });
    }
    return Response.json(
      { error: "Impossible de démarrer la purge." },
      { status: 502 },
    );
  }

  const now = Date.now();
  const h24 = new Date(now - 24 * 3_600_000).toISOString();
  const d30 = new Date(now - 30 * 24 * 3_600_000).toISOString();
  const d90 = new Date(now - 90 * 24 * 3_600_000).toISOString();
  const m13 = new Date(now);
  m13.setUTCMonth(m13.getUTCMonth() - 13);

  const result: PurgeResult = {
    abandoned: 0,
    deleted: 0,
    anonymized_paid: 0,
    anonymized_provisioned: 0,
    ipn_deleted: 0,
  };
  let failure: string | null = null;

  try {
    // 1. Jamais payé après 24 h : abandon + effacement des secrets chiffrés.
    const { data: a1, error: e1 } = await supabase
      .from("pending_signups")
      .update({ status: "abandoned", password_enc: null, sepa_payload_enc: null })
      .eq("status", "payment_pending")
      .lt("created_at", h24)
      .select("id");
    if (e1) throw new Error(`abandon > 24 h : ${e1.message}`);
    result.abandoned = a1?.length ?? 0;

    // 2. Abandonnés jamais payés : suppression pure à 30 j.
    //    On récupère root_id pour purger aussi les preuves de consentement
    //    des chaînes où AUCUN contrat ne s'est formé (aucun paiement).
    const { data: a2, error: e2 } = await supabase
      .from("pending_signups")
      .delete()
      .eq("status", "abandoned")
      .is("paid_at", null)
      .lt("created_at", d30)
      .select("id, root_id");
    if (e2) throw new Error(`delete abandoned : ${e2.message}`);
    result.deleted = a2?.length ?? 0;

    // 2b. Preuves de consentement orphelines de ces chaînes : supprimées
    //     UNIQUEMENT si plus aucun dossier de la chaîne n'existe (un retry
    //     payé garde la chaîne vivante) et si aucun contrat n'y est lié.
    const rootIds = [...new Set((a2 ?? []).map((r) => r.root_id as string))];
    let consentsDeleted = 0;
    for (const rootId of rootIds) {
      const { count } = await supabase
        .from("pending_signups")
        .select("id", { count: "exact", head: true })
        .eq("root_id", rootId);
      if ((count ?? 0) > 0) continue; // chaîne encore vivante
      const { data: dc, error: ec } = await supabase
        .from("consent_records")
        .delete()
        .eq("pending_root_id", rootId)
        .is("subscription_id", null)
        .select("id");
      if (ec) throw new Error(`delete consent_records : ${ec.message}`);
      consentsDeleted += dc?.length ?? 0;
    }
    result.consentsDeleted = consentsDeleted;

    // 3. Abandonnés PAYÉS (remboursés) : anonymisation à 90 j.
    const { data: a3, error: e3 } = await supabase
      .from("pending_signups")
      .update({
        cabinet: {},
        user_info: {},
        client_ip: null,
        user_agent: null,
        password_enc: null,
        sepa_payload_enc: null,
      })
      .eq("status", "abandoned")
      .not("paid_at", "is", null)
      .lt("paid_at", d90)
      .neq("user_info", "{}")
      .select("id");
    if (e3) throw new Error(`anonymisation payés : ${e3.message}`);
    result.anonymized_paid = a3?.length ?? 0;

    // 4. Provisionnés : anonymisation à 90 j (la ligne reste pour la
    //    traçabilité de chaîne ; subscriptions porte le nécessaire).
    const { data: a4, error: e4 } = await supabase
      .from("pending_signups")
      .update({
        cabinet: {},
        user_info: {},
        client_ip: null,
        user_agent: null,
        password_enc: null,
        sepa_payload_enc: null,
      })
      .eq("status", "provisioned")
      .lt("provisioned_at", d90)
      .neq("user_info", "{}")
      .select("id");
    if (e4) throw new Error(`anonymisation provisionnés : ${e4.message}`);
    result.anonymized_provisioned = a4?.length ?? 0;

    // 5. Journal IPN : purge au-delà de 13 mois.
    const { data: a5, error: e5 } = await supabase
      .from("ipn_events")
      .delete()
      .lt("received_at", m13.toISOString())
      .select("id");
    if (e5) throw new Error(`purge ipn_events : ${e5.message}`);
    result.ipn_deleted = a5?.length ?? 0;
  } catch (err) {
    failure = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  } finally {
    await supabase
      .from("job_runs")
      .update({
        status: failure ? "failed" : "succeeded",
        finished_at: new Date().toISOString(),
        result,
        error: failure,
      })
      .eq("id", run.id);
  }

  if (failure) {
    return Response.json(
      { error: "La purge a échoué.", result },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, result });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
