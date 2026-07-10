/**
 * Liens vers le logiciel MediCare (app SaaS, domaine séparé app.medicarepro.fr).
 * La vitrine ne gère PAS l'inscription/connexion : elle redirige vers l'app.
 * URL configurable via NEXT_PUBLIC_APP_URL (cf. .env.local / .env.example).
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.medicarepro.fr";

/** Inscription sur l'app, avec la formule présélectionnée. */
export function registerUrl(plan?: "monthly" | "annual"): string {
  const base = `${APP_URL}/register`;
  return plan ? `${base}?plan=${plan}` : base;
}

/** Connexion à l'app. */
export function loginUrl(): string {
  return `${APP_URL}/login`;
}

/**
 * Résout les liens spéciaux du contenu CMS (convention `href` du registre
 * de sections) : "app:register[:plan]" et "app:login" pointent vers l'app
 * SaaS ; tout autre href (chemin interne, URL absolue, "#") est inchangé.
 */
export function resolveHref(href: string): string {
  switch (href) {
    case "app:login":
      return loginUrl();
    case "app:register":
      return registerUrl();
    case "app:register:monthly":
      return registerUrl("monthly");
    case "app:register:annual":
      return registerUrl("annual");
    default:
      return href;
  }
}
