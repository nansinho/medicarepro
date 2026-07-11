/**
 * Liens vers le tunnel d'inscription et le logiciel MediCare.
 * L'inscription payante se fait désormais SUR LA VITRINE (/inscription,
 * paiement Monetico + mandat SEPA) ; la connexion reste sur l'app SaaS
 * (domaine séparé app.medicarepro.fr, configurable via NEXT_PUBLIC_APP_URL,
 * cf. .env.local / .env.example).
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.medicarepro.fr";

/** Tunnel d'inscription local, avec la formule présélectionnée. */
export function registerUrl(plan?: "monthly" | "annual"): string {
  return plan ? `/inscription?plan=${plan}` : "/inscription";
}

/** Connexion à l'app. */
export function loginUrl(): string {
  return `${APP_URL}/login`;
}

/**
 * Résout les liens spéciaux du contenu CMS (convention `href` du registre
 * de sections) : "app:register[:plan]" pointe vers le tunnel d'inscription
 * de la vitrine (/inscription), "app:login" vers l'app SaaS ; tout autre
 * href (chemin interne, URL absolue, "#") est inchangé.
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
