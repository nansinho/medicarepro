import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, hasSmtp } from "@/lib/env";

/* ============================================================
   Envoi d'email transactionnel via SMTP (nodemailer).
   Serveur uniquement (import "server-only"). Le transporteur est
   créé une seule fois puis mis en cache. Sans SMTP configuré
   (SMTP_HOST/USER/PASS absents), sendMail() lève une erreur
   explicite : l'appelant décide comment la présenter.
   ============================================================ */

let cached: Transporter | null | undefined;

/** Transporteur SMTP (mis en cache), ou null si le SMTP n'est pas configuré. */
function transporter(): Transporter | null {
  if (cached !== undefined) return cached;
  if (!hasSmtp()) {
    cached = null;
    return cached;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env();
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 465 = TLS implicite (secure), sinon STARTTLS négocié (587/25).
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Adresse de réponse (Reply-To) — ex. l'email du visiteur. */
  replyTo?: string;
};

/**
 * Envoie un email. L'expéditeur (From) est SMTP_FROM
 * (noreply@medicarepro.fr par défaut).
 * @throws si le SMTP n'est pas configuré ou si l'envoi échoue.
 */
export async function sendMail(input: MailInput): Promise<void> {
  const tx = transporter();
  if (!tx) {
    throw new Error("SMTP non configuré (SMTP_HOST/USER/PASS manquants).");
  }
  await tx.sendMail({
    from: env().SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  });
}
