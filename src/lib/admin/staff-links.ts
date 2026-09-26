import { emailLinkUrl } from "@/lib/http/site-url";

/* ============================================================
   Liens d'activation et de réinitialisation des comptes du back office.

   GoTrue émet un jeton (hashed_token) que la page /admin/auth/confirm
   échange contre une session. On n'utilise PAS l'action_link de GoTrue :
   il passe par /auth/v1/verify, qui consomme le jeton dès qu'un
   antivirus de messagerie ouvre le lien pour l'analyser. Notre page, elle,
   ne le consomme qu'au moment où la personne valide son mot de passe.

   Le lien mène toujours au domaine public (voir lib/http/site-url) :
   invitation envoyée depuis un poste local comprise.
   ============================================================ */

/** Validité d'un lien, en heures : GOTRUE_MAILER_OTP_EXP par défaut (86 400 s). */
export const STAFF_LINK_HOURS = 24;

export type StaffLinkType = "invite" | "recovery";

/** URL de la page qui fait choisir le mot de passe. */
export function staffConfirmUrl(
  hashedToken: string,
  type: StaffLinkType,
  email: string,
): string {
  const params = new URLSearchParams({ token_hash: hashedToken, type, email });
  return emailLinkUrl(`/admin/auth/confirm?${params.toString()}`);
}

/** redirectTo transmis à GoTrue (inutilisé par nos liens, gardé cohérent). */
export function staffConfirmRedirect(): string {
  return emailLinkUrl("/admin/auth/confirm");
}

/** Date d'expiration du lien envoyé à `sentAt`. */
export function staffLinkExpiry(sentAt: string | Date): Date {
  const t = typeof sentAt === "string" ? Date.parse(sentAt) : sentAt.getTime();
  return new Date(t + STAFF_LINK_HOURS * 3_600_000);
}
