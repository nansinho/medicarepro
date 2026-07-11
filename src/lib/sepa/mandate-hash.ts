import { createHash } from "node:crypto";

/* ============================================================
   Empreinte du texte de mandat — module SERVEUR séparé de
   mandate-text.ts : ce dernier est importé par le tunnel côté
   client (affichage du mandat) et ne doit pas tirer node:crypto
   dans le bundle navigateur.
   ============================================================ */

/**
 * Empreinte SHA-256 (hex) du texte du mandat — archivée en base pour
 * prouver le contenu exact accepté par le débiteur à la signature.
 */
export function mandateTextSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
