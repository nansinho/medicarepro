import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   ACCÈS OFFERTS : le socle commun au back-office, au tunnel, au webhook et au
   worker.

   Une invitation ouvre le tunnel d'inscription habituel, mais la caisse Stripe
   y ouvre un abonnement en période d'essai jusqu'au terme offert. Tout le reste
   (compte dans l'application, contrat, facture à 0 €, rappels) suit les
   chemins existants. Ce fichier ne porte que ce qui est propre à l'invitation.

   LE JETON DU LIEN SE TRAITE COMME UN MOT DE PASSE. Il n'est jamais stocké :
   la base n'en garde que l'empreinte. Une fuite de la table ne donne donc
   aucun lien utilisable.
   ============================================================ */

/** Durée maximale offerte. Au-delà, c'est un partenariat, pas un cadeau. */
export const GIFT_MAX_MONTHS = 12;

/** Durées proposées dans le back-office. */
export const GIFT_MONTH_CHOICES = [1, 2, 3, 6, 9, 12] as const;

/** Validité du lien d'invitation, à compter de son dernier envoi. */
export const GIFT_LINK_DAYS = 60;

export type GiftInvitationStatus = "pending" | "claimed" | "revoked";

export type GiftInvitation = {
  id: string;
  email: string;
  months: number;
  reason: string;
  require_card: boolean;
  expires_at: string;
  status: GiftInvitationStatus;
  pending_signup_id: string | null;
  subscription_id: string | null;
  app_cabinet_id: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
  sent_count: number;
  last_sent_at: string | null;
  created_by_email: string | null;
  created_at: string;
};

export const GIFT_INVITATION_COLUMNS =
  "id, email, months, reason, require_card, expires_at, status, pending_signup_id, subscription_id, app_cabinet_id, claimed_at, revoked_at, sent_count, last_sent_at, created_by_email, created_at";

/* ------------------------------------------------------------
   Jeton et dates.
   ------------------------------------------------------------ */

/** Empreinte d'un jeton, telle que la base la conserve. */
export function hashGiftToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Un jeton neuf (256 bits, sûr dans une URL) et son empreinte. */
export function newGiftToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashGiftToken(token) };
}

/**
 * Un jeton a-t-il la forme de ceux qu'on émet ? Filtre les URL bricolées
 * avant toute requête : 43 caractères base64url, rien d'autre.
 */
export function isGiftTokenShape(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * date + N mois, jour du mois borné : un accès offert le 31 août pour six mois
 * se termine le 28 (ou 29) février, pas le 3 mars.
 */
export function addGiftMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Fin de validité d'un lien envoyé maintenant. */
export function giftLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + GIFT_LINK_DAYS * 86_400_000);
}

/** « 3 mois », « 1 mois ». */
export function monthsLabel(months: number): string {
  return `${months} mois`;
}

/* ------------------------------------------------------------
   Validation de la saisie du back-office. Pure : testée sans base.
   ------------------------------------------------------------ */

export type GiftDraft = {
  email: string;
  months: number;
  reason: string;
  requireCard: boolean;
};

export function parseGiftDraft(input: {
  email: unknown;
  months: unknown;
  reason: unknown;
  requireCard: unknown;
}): { ok: true; draft: GiftDraft } | { ok: false; field: string; error: string } {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    return { ok: false, field: "email", error: "Adresse email invalide." };
  }
  const months = Number.parseInt(String(input.months ?? ""), 10);
  if (!Number.isInteger(months) || months < 1 || months > GIFT_MAX_MONTHS) {
    return {
      ok: false,
      field: "months",
      error: `Choisissez une durée entre 1 et ${GIFT_MAX_MONTHS} mois.`,
    };
  }
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 200) {
    return {
      ok: false,
      field: "reason",
      error: "Indiquez le motif en quelques mots (200 caractères au plus).",
    };
  }
  /* Pas de valeur par défaut, volontairement : c'est ce choix qui décide si le
     bénéficiaire sera prélevé à l'échéance. Il doit être fait en conscience. */
  if (input.requireCard !== "yes" && input.requireCard !== "no") {
    return {
      ok: false,
      field: "requireCard",
      error: "Indiquez ce qui se passe à la fin de la période offerte.",
    };
  }
  return {
    ok: true,
    draft: { email, months, reason, requireCard: input.requireCard === "yes" },
  };
}

/* ------------------------------------------------------------
   Lecture d'une invitation depuis le lien.
   ------------------------------------------------------------ */

export type GiftLookup =
  | { ok: true; invitation: GiftInvitation }
  | { ok: false; reason: "unknown" | "revoked" | "claimed" | "expired" };

/**
 * L'invitation que désigne ce jeton, si elle est encore utilisable.
 *
 * Les refus sont nommés pour que la page dise quoi faire, mais sans rien
 * révéler de la personne invitée : aucune adresse n'est renvoyée tant que le
 * jeton n'est pas valide.
 */
export async function lookupGiftInvitation(
  supabase: SupabaseClient,
  token: unknown,
  now: Date = new Date(),
): Promise<GiftLookup> {
  if (!isGiftTokenShape(token)) return { ok: false, reason: "unknown" };
  const { data } = await supabase
    .from("gift_invitations")
    .select(GIFT_INVITATION_COLUMNS)
    .eq("token_hash", hashGiftToken(token))
    .maybeSingle();
  const invitation = (data as GiftInvitation | null) ?? null;
  if (!invitation) return { ok: false, reason: "unknown" };
  if (invitation.status === "revoked") return { ok: false, reason: "revoked" };
  if (invitation.status === "claimed") return { ok: false, reason: "claimed" };
  if (Date.parse(invitation.expires_at) <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invitation };
}

/** Ce qu'on dit au visiteur d'un lien qui ne mène plus nulle part. */
export const GIFT_LOOKUP_MESSAGES: Record<
  Exclude<GiftLookup, { ok: true }>["reason"],
  { title: string; text: string }
> = {
  unknown: {
    title: "Lien d'invitation introuvable",
    text: "Ce lien est incomplet ou n'existe pas. Vérifiez que vous avez bien ouvert le lien reçu par email, en entier.",
  },
  revoked: {
    title: "Invitation retirée",
    text: "Cette invitation n'est plus valable. Si vous pensez qu'il s'agit d'une erreur, écrivez-nous.",
  },
  claimed: {
    title: "Invitation déjà utilisée",
    text: "Votre accès offert est déjà ouvert. Connectez-vous à MediCare Pro avec l'adresse et le mot de passe choisis lors de l'inscription.",
  },
  expired: {
    title: "Lien d'invitation expiré",
    text: "Ce lien n'est plus valable. Écrivez-nous : nous vous en renvoyons un nouveau.",
  },
};

/**
 * Réserve l'invitation pour un dossier, au moment où la période offerte s'ouvre
 * chez Stripe.
 *
 * ATOMIQUE : la condition `status = pending` est dans la requête elle-même.
 * Deux onglets ouverts sur le même lien peuvent aller jusqu'à la caisse, mais
 * un seul obtient l'invitation. L'autre reçoit `false`, et l'appelant résilie
 * l'abonnement d'essai qui n'aurait jamais dû naître.
 */
export async function claimGiftInvitation(
  supabase: SupabaseClient,
  invitationId: string,
  pendingSignupId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gift_invitations")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      pending_signup_id: pendingSignupId,
    })
    .eq("id", invitationId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`réservation de l'invitation : ${error.message}`);
  return Boolean(data && data.length > 0);
}

/* ------------------------------------------------------------
   État affiché au back-office. Pur : testé sans base.
   ------------------------------------------------------------ */

export type GiftContractFacts = {
  status: string;
  gift_ends_at: string | null;
  renewal_count: number;
} | null;

export type GiftDisplayState =
  | "pending" // envoyée, en attente
  | "link_expired" // jamais utilisée, lien périmé
  | "revoked"
  | "opening" // période ouverte chez Stripe, compte en cours de création
  | "active" // période offerte en cours
  | "converted" // premier paiement encaissé après la période offerte
  | "ended"; // période terminée sans souscription

export function giftDisplayState(
  invitation: Pick<GiftInvitation, "status" | "expires_at">,
  contract: GiftContractFacts,
  now: Date = new Date(),
): GiftDisplayState {
  if (invitation.status === "revoked") return "revoked";
  if (invitation.status === "pending") {
    return Date.parse(invitation.expires_at) <= now.getTime()
      ? "link_expired"
      : "pending";
  }
  if (!contract) return "opening";
  if (contract.renewal_count > 0) return "converted";
  if (contract.status === "expired" || contract.status === "canceled") return "ended";
  return "active";
}

export const GIFT_STATE_LABELS: Record<GiftDisplayState, string> = {
  pending: "Envoyée",
  link_expired: "Lien expiré",
  revoked: "Retirée",
  opening: "Compte en création",
  active: "Période offerte en cours",
  converted: "Abonné",
  ended: "Terminée sans suite",
};
