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

/* ============================================================
   Liens qui PARTENT PAR EMAIL vers quelqu'un d'autre.

   Une invitation ou une réinitialisation est ouverte sur le poste du
   destinataire, pas sur celui qui l'envoie. Envoyée depuis un poste de
   développement, elle portait « http://localhost:3004 » : un lien mort
   pour quiconque d'autre. La base et GoTrue étant les mêmes en local et
   en production, le jeton est valable sur le domaine public : c'est donc
   là que le lien doit mener, d'où qu'il parte.

   EMAIL_LINKS_ORIGIN force une autre origine (recette d'un tunnel en
   local, par exemple). Sinon : l'origine du site, sauf si elle est locale.
   ============================================================ */

/** Adresse qui ne s'ouvre que sur la machine qui l'a produite. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      /^127\./.test(hostname)
    );
  } catch {
    return true;
  }
}

/** Origine des liens envoyés par email, jamais une adresse locale par défaut. */
export function emailLinkOrigin(): string {
  const forced = process.env.EMAIL_LINKS_ORIGIN;
  if (forced) return forced.replace(/\/$/, "");
  const origin = siteOrigin();
  return isLocalOrigin(origin) ? FALLBACK : origin;
}

/** URL absolue d'un lien envoyé par email (invitation, réinitialisation). */
export function emailLinkUrl(path: string): string {
  return `${emailLinkOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
