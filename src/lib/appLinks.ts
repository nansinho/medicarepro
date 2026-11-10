/**
 * Liens vers le tunnel d'inscription et le logiciel MediCare.
 *
 * La connexion est toujours sur l'app SaaS (domaine séparé app.medicarepro.fr,
 * configurable via NEXT_PUBLIC_APP_URL, cf. .env.local / .env.example).
 *
 * L'inscription dépend de l'interrupteur INSCRIPTION_DANS_APP
 * (src/lib/inscription-dans-app.ts) :
 *   - coupé : tunnel de la vitrine (/inscription, encaissement par la vitrine) ;
 *   - allumé : page /register de l'application, qui encaisse elle-même.
 * La formule présélectionnée voyage dans les deux cas par ?plan=monthly|annual,
 * valeurs que les deux tunnels comprennent.
 */
import { inscriptionDansApp } from "@/lib/inscription-dans-app";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.medicarepro.fr";

export type PlanKey = "monthly" | "annual";

/** Inscription dans l'application, avec la formule présélectionnée. */
export function appRegisterUrl(plan?: PlanKey): string {
  return plan ? `${APP_URL}/register?plan=${plan}` : `${APP_URL}/register`;
}

/** Tunnel d'inscription de la vitrine, avec la formule présélectionnée. */
export function vitrineRegisterUrl(plan?: PlanKey): string {
  return plan ? `/inscription?plan=${plan}` : "/inscription";
}

/**
 * Où un visiteur s'inscrit aujourd'hui. À n'évaluer que côté serveur : dans
 * un bundle navigateur l'interrupteur est invisible et la réponse serait
 * toujours celle de la vitrine (voir inscription-dans-app.ts).
 */
export function registerUrl(plan?: PlanKey): string {
  return inscriptionDansApp() ? appRegisterUrl(plan) : vitrineRegisterUrl(plan);
}

/** Connexion à l'app. */
export function loginUrl(): string {
  return `${APP_URL}/login`;
}

/**
 * Résout les liens spéciaux du contenu CMS (convention `href` du registre
 * de sections) : "app:register[:plan]" pointe vers l'inscription du moment
 * (registerUrl), "app:login" vers l'app SaaS ; tout autre href (chemin
 * interne, URL absolue, "#") est inchangé.
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
