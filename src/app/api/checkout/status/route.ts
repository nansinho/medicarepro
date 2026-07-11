import { type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { timingSafeEqualString } from "@/lib/crypto";
import { clientIpFrom } from "@/lib/http/client-ip";
import { REFUSED_CODE } from "@/lib/monetico";

/* ============================================================
   GET /api/checkout/status?ref=<référence> — suivi du dossier
   par la page /inscription/confirmation (polling).
   Accès STRICTEMENT réservé au porteur du cookie httpOnly
   mp_checkout ("<référence>.<status_token>") : la référence doit
   correspondre ET le token est comparé à temps constant.
   → 200 { status, paymentRefused, loginUrl } | 403 | 429 | 503.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = serviceClient();
  if (!supabase) {
    return Response.json({ error: "Service indisponible." }, { status: 503 });
  }

  const ref = request.nextUrl.searchParams.get("ref") ?? "";
  if (!/^[A-Z0-9]{12}$/.test(ref)) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  // Cookie "mp_checkout=<référence>.<status_token>".
  const cookie = request.cookies.get("mp_checkout")?.value ?? "";
  const dot = cookie.indexOf(".");
  const cookieRef = dot > 0 ? cookie.slice(0, dot) : "";
  const cookieToken = dot > 0 ? cookie.slice(dot + 1) : "";
  if (!cookieRef || !cookieToken || cookieRef !== ref) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("pending_signups")
    .select("id, status, status_token, code_retour, login_url")
    .eq("monetico_reference", ref)
    .maybeSingle();
  if (error || !data) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const row = data as {
    id: string;
    status: string;
    status_token: string;
    code_retour: string | null;
    login_url: string | null;
  };

  if (!timingSafeEqualString(cookieToken, row.status_token)) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  // Anti-hammering du polling : 120 requêtes / minute / IP.
  const ip = clientIpFrom(request.headers);
  const { data: allowed, error: rlError } = await supabase.rpc(
    "hit_rate_limit",
    { p_bucket: `status:${ip}`, p_limit: 120, p_window_seconds: 60 },
  );
  if (!rlError && allowed === false) {
    return Response.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  return Response.json({
    status: row.status,
    paymentRefused:
      row.status === "payment_pending" && row.code_retour === REFUSED_CODE,
    loginUrl: row.status === "provisioned" ? row.login_url : null,
  });
}
