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
