import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* ============================================================
   Proxy (convention Next 16, ex-middleware) — périmètre /admin/*.

   Deux responsabilités :
   1. Rafraîchir la session Supabase : getUser() valide le JWT
      auprès de GoTrue et réémet les cookies expirés (setAll).
      C'est LE point de refresh — server.ts est en lecture seule.
   2. Redirections optimistes : non-staff → /admin/login, et
      staff déjà connecté → /admin s'il visite la page de login.

   Le proxy n'est qu'un pré-filtre : la vérification autoritaire
   vit dans le layout admin (requireStaff) et les server actions.
   ============================================================ */

const STAFF_ROLES = ["admin", "editor"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  /* Supabase non configuré (Phase 1 sans env) : back office indisponible,
     requireStaff redirigera et la page de login affichera l'erreur. */
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  /* getUser() (jamais getSession) : validation serveur du JWT. */
  const { data } = await supabase.auth.getUser();
  const role = data.user?.app_metadata?.role as string | undefined;
  const isStaff = role != null && STAFF_ROLES.includes(role);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  /* Routes publiques du back office : login + confirmation
     d'invitation / récupération de mot de passe (l'utilisateur
     n'a pas encore de session à ce stade). */
  const isPublicAdminPath =
    isLogin || pathname.startsWith("/admin/auth/");

  if (!isStaff && !isPublicAdminPath) {
    return withSessionCookies(
      NextResponse.redirect(new URL("/admin/login", request.url)),
      response,
    );
  }
  if (isStaff && isLogin) {
    return withSessionCookies(
      NextResponse.redirect(new URL("/admin", request.url)),
      response,
    );
  }
  return response;
}

/** Reporte les cookies (tokens rafraîchis) sur une réponse de redirection. */
function withSessionCookies(redirect: NextResponse, from: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: "/admin/:path*",
};
