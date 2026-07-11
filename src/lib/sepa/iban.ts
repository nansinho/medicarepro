import { electronicFormatIBAN } from "ibantools";

/* ============================================================
   Affichage sécurisé des IBAN.
   RÈGLE : l'IBAN complet ne vit que chiffré en base
   (sepa_mandates.iban_encrypted) ou en mémoire le temps d'une
   remise. Partout ailleurs (emails, PDF, UI, logs) on n'affiche
   QUE la forme masquée produite ici.
   ============================================================ */

/** IBAN au format électronique : sans espaces ni tirets, en majuscules. */
function normalizeIban(iban: string): string {
  return electronicFormatIBAN(iban) ?? iban.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * Masque un IBAN pour affichage : 4 premiers caractères + 4 derniers,
 * le reste remplacé par des puces — ex. « FR76 •••• •••• 0189 ».
 */
export function maskIban(iban: string): string {
  const electronic = normalizeIban(iban);
  // Trop court pour exposer début + fin sans révéler le compte : tout masquer.
  if (electronic.length < 12) return "••••";
  return `${electronic.slice(0, 4)} •••• •••• ${electronic.slice(-4)}`;
}

/** Les 4 derniers caractères de l'IBAN (colonne sepa_mandates.iban_last4). */
export function ibanLast4(iban: string): string {
  return normalizeIban(iban).slice(-4);
}
