import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";

/* ============================================================
   Espace abonnement du praticien : entrée et session.

   DEUX JETONS, DEUX DURÉES DE VIE, DEUX BUTS :

   1. Le LIEN D'ENTRÉE (`portal_links`, 0029) — émis à la demande de
      l'application métier (ou du back-office), valable quelques minutes,
      consommé au premier usage. Il ne contient que le `jti` chiffré : ni
      identifiant de cabinet, ni email, rien d'exploitable hors de notre base.

   2. La SESSION — un cookie httpOnly chiffré, sans table. Un espace consulté
      trois fois par an ne justifie pas un registre de sessions, sa purge et sa
      surface RLS ; l'AAD dédiée empêche de faire passer un jeton d'entrée pour
      une session, et inversement.

   Le lien de renouvellement historique (renewal-link.ts) n'est PAS réutilisé :
   il n'expire pas et ne se consomme pas. On ne bâtit pas un espace qui
   permettra de résilier sur un jeton éternel.
   ============================================================ */

const LINK_AAD = "portal-link";
const SESSION_AAD = "portal-session";

/** Nom du cookie de session client (distinct du cookie de suivi du tunnel). */
export const PORTAL_COOKIE = "mp_portal";

/** Durée de vie d'un lien d'entrée. Court : il est toujours ré-émissible. */
export const LINK_TTL_MINUTES = 15;

/** Durée d'une session ouverte depuis un lien. */
export const SESSION_TTL_MINUTES = 45;

/* ------------------------------------------------------------
   Identité transmise par l'application.
   ------------------------------------------------------------ */

export type PortalCabinet = {
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  invoicePrefix: string;
  siretNumber?: string;
  adminEmail: string;
  adminName: string;
  /** Formule connue de l'app, à titre indicatif seulement. */
  plan?: string | null;
  /** Sièges collaborateurs accordés par l'app, à titre indicatif. */
  maxAssistants?: number | null;
};

export type PortalLinkRow = {
  id: string;
  jti: string;
  app_cabinet_id: string;
  app_user_id: string | null;
  cabinet: PortalCabinet;
  expires_at: string;
  consumed_at: string | null;
};

/* ------------------------------------------------------------
   Lien d'entrée.
   ------------------------------------------------------------ */

/** Crée un lien d'entrée et rend l'URL complète à ouvrir. */
export async function createPortalLink(
  supabase: SupabaseClient,
  input: {
    appCabinetId: string;
    appUserId?: string | null;
    cabinet: PortalCabinet;
    createdVia: "app" | "admin";
    createdBy?: string | null;
    clientIp?: string | null;
  },
): Promise<{ url: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000);

  const { data, error } = await supabase
    .from("portal_links")
    .insert({
      app_cabinet_id: input.appCabinetId,
      app_user_id: input.appUserId ?? null,
      cabinet: input.cabinet,
      expires_at: expiresAt.toISOString(),
      created_via: input.createdVia,
      created_by: input.createdBy ?? null,
      created_ip: input.clientIp ?? null,
    })
    .select("jti")
    .single();

  if (error || !data) {
    throw new Error(`insert portal_links : ${error?.message ?? "aucune ligne"}`);
  }

  /* L'URL vise le point d'entrée, pas la page : ouvrir une session pose un
     cookie, ce qu'un composant serveur ne peut pas faire (Next 16 : `.set()`
     n'est permis que dans un Route Handler ou une Server Function). */
  const token = encryptSecret(String(data.jti), LINK_AAD);
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    url: `${base}/mon-abonnement/entrer?t=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

/**
 * Consomme un lien d'entrée. Renvoie null si le jeton est invalide, périmé, ou
 * déjà utilisé. La consommation est atomique (`consumed_at is null` dans le
 * WHERE) : deux ouvertures simultanées ne peuvent pas réussir toutes les deux.
 */
export async function consumePortalLink(
  supabase: SupabaseClient,
  token: string,
): Promise<PortalLinkRow | null> {
  let jti: string;
  try {
    jti = decryptSecret(token, LINK_AAD);
  } catch {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(jti)) return null;

  const { data } = await supabase
    .from("portal_links")
    .update({ consumed_at: new Date().toISOString() })
    .eq("jti", jti)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, jti, app_cabinet_id, app_user_id, cabinet, expires_at, consumed_at")
    .maybeSingle();

  return (data as PortalLinkRow | null) ?? null;
}

/* ------------------------------------------------------------
   Session.
   ------------------------------------------------------------ */

export type PortalSession = {
  appCabinetId: string;
  appUserId: string | null;
  cabinet: PortalCabinet;
  /** Expiration absolue (epoch ms). */
  exp: number;
};

/** Valeur du cookie de session (chiffrée, scellée par son AAD). */
export function sealSession(session: PortalSession): string {
  return encryptSecret(JSON.stringify(session), SESSION_AAD);
}

/** Session valide, ou null (jeton illisible, altéré, ou expiré). */
export function openSession(cookieValue: string | undefined): PortalSession | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(decryptSecret(cookieValue, SESSION_AAD)) as PortalSession;
    if (!parsed?.appCabinetId || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Session issue d'un lien fraîchement consommé. */
export function sessionFromLink(link: PortalLinkRow): PortalSession {
  return {
    appCabinetId: link.app_cabinet_id,
    appUserId: link.app_user_id,
    cabinet: link.cabinet,
    exp: Date.now() + SESSION_TTL_MINUTES * 60_000,
  };
}
