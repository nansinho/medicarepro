import { type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import {
  consumePortalLink,
  sealSession,
  sessionFromLink,
  PORTAL_COOKIE,
  SESSION_TTL_MINUTES,
} from "@/lib/billing/portal";

/* ============================================================
   GET /mon-abonnement/entrer?t=… — consommation du lien d'entrée.

   Le lien est à USAGE UNIQUE : cette route l'échange contre un cookie de
   session, puis redirige vers l'espace. Deux conséquences voulues :
   - le jeton ne reste pas dans la barre d'adresse, l'historique ni les
     en-têtes Referer une fois la page ouverte ;
   - un lien transféré ou retrouvé plus tard ne rouvre rien.

   Route Handler et non composant serveur : en Next 16, poser un cookie n'est
   permis que depuis un Route Handler ou une Server Function.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PORTAL_COOKIE}=${value}; Path=/; Max-Age=${SESSION_TTL_MINUTES * 60}; HttpOnly; SameSite=Lax${secure}`;
}

/* ⚠️ REDIRECTIONS RELATIVES, ET C'EST VOLONTAIRE.
   `request.nextUrl.origin` vaut « https://0.0.0.0:3000 » en production : le
   serveur standalone construit son URL de base avec HOSTNAME et PORT
   (Dockerfile) dès lors que `trustHostHeader` est faux, et cette option n'est
   pas exposée par Next 16. Une redirection absolue dérivée de la requête
   envoyait donc le praticien sur une adresse injoignable, APRÈS avoir consommé
   son jeton à usage unique : il se retrouvait dehors sans pouvoir réessayer.
   Un `Location` relatif est valide depuis la RFC 7231 et n'a besoin d'aucune
   base — c'est le navigateur qui la résout, correctement. */

function back(error: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/mon-abonnement?e=${encodeURIComponent(error)}` },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!token) return back("lien");

  const supabase = serviceClient();
  if (!supabase) return back("indispo");

  const link = await consumePortalLink(supabase, token);
  if (!link) return back("lien");

  return new Response(null, {
    status: 303,
    headers: {
      location: "/mon-abonnement",
      "set-cookie": sessionCookie(sealSession(sessionFromLink(link))),
    },
  });
}
