/* ============================================================
   Origine publique du site — source unique des URL absolues.

   POURQUOI CE MODULE EXISTE : en production, le serveur Next standalone
   construit son URL de base avec HOSTNAME et PORT (Dockerfile), soit
   « https://0.0.0.0:3000 ». `request.url` et `request.nextUrl.origin` portent
   donc cette valeur, et non le domaine public — l'option qui changerait ce
   comportement (`trustHostHeader`) n'est pas exposée par Next 16.

   Constaté en production : une redirection dérivée de la requête a envoyé un
   praticien sur https://0.0.0.0:3000/mon-abonnement, après avoir consommé son
   jeton d'accès à usage unique.

   RÈGLE : toute URL absolue produite côté serveur passe par ici. Un chemin
   relatif reste préférable quand c'est possible (en-tête `Location`), mais
   `NextResponse.redirect` exige une URL absolue.

   Volontairement sans dépendance (ni zod, ni server-only) : ce module est aussi
   importé par le proxy, qui tourne dans un runtime restreint.
   ============================================================ */

/** Domaine de repli, aligné sur le défaut du schéma d'environnement. */
const FALLBACK = "https://medicarepro.fr";

/** Origine publique, sans barre oblique finale. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK).replace(/\/$/, "");
}

/** URL absolue publique pour un chemin interne (« /admin/login »). */
export function siteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
