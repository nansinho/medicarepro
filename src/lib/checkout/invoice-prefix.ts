/* ============================================================
   Génération du préfixe de facturation (invoicePrefix).

   Le contrat dev B exige un invoicePrefix UNIQUE GLOBALEMENT.
   On ne le demande JAMAIS au client : il est dérivé du nom du
   cabinet (initiales / premières lettres), puis dédoublonné via
   check-availability + suffixes numériques (DUP, DUP2, DUP3…).
   ============================================================ */

/** Retire accents et caractères non alphabétiques, majuscules. */
function normalizeLetters(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots vides ignorés pour les initiales. */
const STOP_WORDS = new Set([
  "DE", "DU", "DES", "LA", "LE", "LES", "ET", "D", "L",
  "CABINET", "PODOLOGIE", "PEDICURIE", "SCM", "SELARL", "SARL",
]);

/**
 * Préfixe de base à partir du nom du cabinet : initiales des mots
 * significatifs (max 4), ou premières lettres du premier mot si
 * un seul mot. Toujours 3 à 4 lettres, fallback "MPC".
 */
export function baseInvoicePrefix(cabinetName: string): string {
  const words = normalizeLetters(cabinetName)
    .split(" ")
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  let prefix: string;
  if (words.length === 0) {
    prefix = "MPC";
  } else if (words.length === 1) {
    prefix = words[0].slice(0, 4);
  } else {
    prefix = words
      .slice(0, 4)
      .map((w) => w[0])
      .join("");
  }

  if (prefix.length < 3) {
    prefix = (prefix + (words[0] ?? "MPC")).slice(0, 3);
  }
  return prefix.slice(0, 4);
}

/**
 * Candidats successifs pour le dédoublonnage : "DUP", "DUP2", …
 * puis un candidat aléatoire en dernier recours (course résiduelle).
 */
export function invoicePrefixCandidates(
  cabinetName: string,
  count = 5,
): string[] {
  const base = baseInvoicePrefix(cabinetName);
  const candidates = [base];
  for (let i = 2; candidates.length < count; i++) {
    candidates.push(`${base}${i}`);
  }
  // Dernier recours : suffixe pseudo-aléatoire (2 caractères).
  const salt = Math.random().toString(36).slice(2, 4).toUpperCase();
  candidates.push(`${base}${salt}`);
  return candidates;
}
