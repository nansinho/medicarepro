import "server-only";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isSameOriginJsonPost } from "@/lib/http/origin-guard";
import {
  openSession,
  PORTAL_COOKIE,
  type PortalSession,
} from "@/lib/billing/portal";
import {
  CHANGEABLE_SUBSCRIPTION_COLUMNS,
  type ChangeableSubscription,
} from "@/lib/billing/changes";

/* ============================================================
   Garde commune aux routes d'action de l'espace abonnement.

   Les quatre mêmes vérifications reviennent partout, et l'ordre compte :
     1. base configurée — sinon on ne peut rien tracer, donc rien engager ;
     2. même origine — ces POST ne doivent venir que de nos pages ;
     3. session valide — c'est la seule identité du praticien ici ;
     4. plafond par IP — le cookie n'empêche pas de marteler une route.

   Les factoriser évite l'oubli silencieux qui transforme une action bancaire
   en point d'entrée ouvert. Chaque route ajoute ensuite SES règles métier.
   ============================================================ */

export type PortalContext = {
  supabase: SupabaseClient;
  session: PortalSession;
  ip: string;
  userAgent: string | null;
};

export type PortalGuardResult =
  | { ok: true; ctx: PortalContext }
  | { ok: false; response: Response };

export async function guardPortalPost(
  request: NextRequest,
  bucket: string,
  limit = 10,
): Promise<PortalGuardResult> {
  if (!isSameOriginJsonPost(request)) {
    return {
      ok: false,
      response: Response.json({ error: "Requête refusée." }, { status: 403 }),
    };
  }

  const supabase = serviceClient();
  if (!supabase) {
    return {
      ok: false,
      response: Response.json(
        { error: "Service momentanément indisponible." },
        { status: 503 },
      ),
    };
  }

  const jar = await cookies();
  const session = openSession(jar.get(PORTAL_COOKIE)?.value);
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "Votre session a expiré. Rouvrez votre espace depuis votre logiciel.",
          expired: true,
        },
        { status: 401 },
      ),
    };
  }

  const ip = clientIpFrom(request.headers);
  const { data: allowed } = await supabase.rpc("hit_rate_limit", {
    p_bucket: `${bucket}:${ip}`,
    p_limit: limit,
    p_window_seconds: 600,
  });
  if (allowed === false) {
    return {
      ok: false,
      response: Response.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      supabase,
      session,
      ip,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
  };
}

/**
 * L'abonnement VIVANT du cabinet de la session.
 *
 * Le rattachement se fait toujours par `app_cabinet_id`, jamais par un
 * identifiant de souscription venu du navigateur : c'est ce qui rend
 * structurellement impossible d'agir sur l'abonnement d'un autre cabinet.
 */
export async function liveSubscription(
  supabase: SupabaseClient,
  appCabinetId: string,
): Promise<ChangeableSubscription | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(CHANGEABLE_SUBSCRIPTION_COLUMNS)
    .eq("app_cabinet_id", appCabinetId)
    .in("status", ["active", "past_due", "suspended", "pending_mandate"])
    .maybeSingle();
  return (data as ChangeableSubscription | null) ?? null;
}
