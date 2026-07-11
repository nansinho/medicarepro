import "server-only";
import { createHmac } from "node:crypto";
import { timingSafeEqualString } from "@/lib/crypto";

/* ============================================================
   Monetico Paiement « classique » (CM-CIC), paiement one-shot.

   - Formulaire « Aller » : POST navigateur vers paiement.cgi,
     scellé par un MAC HMAC-SHA1 (clé 40 hex → dérivation
     _getUsableKey, portage fidèle du kit officiel PHP).
   - Interface « Retour » (IPN) : Monetico POST le résultat sur
     notre URL ; on recalcule le MAC sur les champs reçus (sauf
     MAC) et on répond version=2\ncdr=0\n (ou cdr=1 si invalide).

   ✅ ORDRE DU SCEAU FIGÉ ET VALIDÉ le 11/07/2026 contre la
   plateforme TEST réelle (TPE 40OCXXI, référence MP1MS9HGJ7QE) :
   la convention « champ=valeur triés alphabétiquement, joints
   par * » (kit v3.x) a été ACCEPTÉE par p.monetico-services.com
   /test/paiement.cgi (page de paiement affichée). Ne pas changer
   cet ordre. Reste à observer un IPN réel (interface Retour) pour
   confirmer le sens retour — même convention attendue.

   RÈGLE : ne JAMAIS logger la clé, le MAC ni le payload IPN.
   ============================================================ */

export const MONETICO_VERSION = "3.0";

export const MONETICO_PAYMENT_URLS = {
  test: "https://p.monetico-services.com/test/paiement.cgi",
  production: "https://p.monetico-services.com/paiement.cgi",
} as const;

export type MoneticoMode = keyof typeof MONETICO_PAYMENT_URLS;

/** Réponses attendues par Monetico sur l'IPN (corps texte brut, à l'octet près). */
export const IPN_ACK_OK = "version=2\ncdr=0\n";
export const IPN_ACK_KO = "version=2\ncdr=1\n";

/** Codes-retour « paiement accepté » (test / production). */
export const ACCEPTED_CODES = ["payetest", "paiement"] as const;
/** Code-retour « paiement refusé ». */
export const REFUSED_CODE = "Annulation";

export type MoneticoConfig = {
  tpe: string;
  /** Clé de sécurité : 40 caractères hexadécimaux fournis par la banque. */
  key: string;
  societe: string;
  mode: MoneticoMode;
};

/* ------------------------------------------------------------
   Dérivation de la clé HMAC — portage fidèle de
   MoneticoPaiement_Hmac::_getUsableKey() du kit officiel PHP.
   Ne JAMAIS remplacer par un simple Buffer.from(key, "hex") :
   les deux derniers caractères subissent une transformation
   spéciale (certaines clés contiennent des lettres hors hex).
   ------------------------------------------------------------ */
export function getUsableKey(key40: string): Buffer {
  if (key40.length !== 40) {
    throw new Error("Clé Monetico invalide : 40 caractères attendus.");
  }
  let hexStrKey = key40.slice(0, 38);
  const hexFinal = key40.slice(38, 40) + "00";
  const cca0 = hexFinal.charCodeAt(0);

  if (cca0 > 70 && cca0 < 97) {
    // Lettre majuscule au-delà de F (G..Z) : décalage de 23 (G→0x30…)
    hexStrKey += String.fromCharCode(cca0 - 23) + hexFinal.charAt(1);
  } else if (hexFinal.charAt(1) === "M") {
    hexStrKey += hexFinal.charAt(0) + "0";
  } else {
    hexStrKey += hexFinal.slice(0, 2);
  }

  return Buffer.from(hexStrKey, "hex");
}

/* ------------------------------------------------------------
   Sceau (MAC) — HMAC-SHA1 hex minuscules sur la chaîne
   « champ=valeur » triée alphabétiquement, jointe par « * »,
   en EXCLUANT le champ MAC lui-même.
   ------------------------------------------------------------ */

/** Chaîne à sceller : champs (sauf MAC) triés, "k=v" joints par "*". */
export function buildSealBase(fields: Record<string, string>): string {
  return Object.keys(fields)
    .filter((k) => k !== "MAC")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("*");
}

/** MAC HMAC-SHA1 (hex minuscules) d'une chaîne scellée. */
export function computeSeal(base: string, key40: string): string {
  return createHmac("sha1", getUsableKey(key40))
    .update(base, "utf8")
    .digest("hex")
    .toLowerCase();
}

/** Sceau des champs d'un formulaire/IPN (exclut MAC, trie, HMAC-SHA1). */
export function sealFields(
  fields: Record<string, string>,
  key40: string,
): string {
  return computeSeal(buildSealBase(fields), key40);
}

/**
 * Vérifie le MAC d'une notification IPN : recalcule le sceau sur TOUS les
 * champs reçus (sauf MAC) et compare à temps constant, casse ignorée.
 */
export function verifyIpnSeal(
  fields: Record<string, string>,
  key40: string,
): boolean {
  const received = fields["MAC"];
  if (!received) return false;
  const expected = sealFields(fields, key40);
  return timingSafeEqualString(expected, received.toLowerCase());
}

/* ------------------------------------------------------------
   Formulaire « Aller ».
   ------------------------------------------------------------ */

export type PaymentRequest = {
  /** Référence commande : 12 caractères alphanumériques, unique. */
  reference: string;
  amountCents: number;
  currency?: string; // ISO 4217, défaut EUR
  /** Email du payeur (champ `mail`). */
  email: string;
  urlRetourOk: string;
  urlRetourErr: string;
  /**
   * Contexte de commande (DSP2/3DSv2) : adresse de facturation, encodé
   * base64(JSON) dans le champ contexte_commande.
   */
  billingContext: {
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string; // "FR"
  };
  /** Renseigné tel quel dans texte-libre (retourné dans l'IPN). */
  texteLibre?: string;
  /** Date du paiement — par défaut maintenant (utile pour les tests). */
  now?: Date;
};

/** Montant au format Monetico : "658.08EUR". */
export function formatMontant(cents: number, currency = "EUR"): string {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Montant invalide (centimes entiers positifs attendus).");
  }
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `${euros}.${rest}${currency}`;
}

/** Parse "29.88EUR" (ou "29,88EUR", "10GBP") → centimes + devise. */
export function parseMontant(
  montant: string,
): { cents: number; currency: string } | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?([A-Z]{3})$/.exec(montant.trim());
  if (!m) return null;
  const euros = parseInt(m[1], 10);
  const decimals = (m[2] ?? "").padEnd(2, "0");
  return { cents: euros * 100 + parseInt(decimals || "0", 10), currency: m[3] };
}

/** Date au format Monetico JJ/MM/AAAA:HH:MM:SS (heure de Paris). */
export function formatMoneticoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}:${get("hour")}:${get("minute")}:${get("second")}`;
}

export type SealedPaymentForm = {
  /** URL de paiement (test ou production selon le mode). */
  action: string;
  /** Champs du formulaire à auto-soumettre (MAC inclus). */
  fields: Record<string, string>;
};

/** Construit le formulaire de paiement scellé (à auto-soumettre en POST). */
export function buildPaymentForm(
  req: PaymentRequest,
  config: MoneticoConfig,
): SealedPaymentForm {
  if (!/^[A-Z0-9]{12}$/.test(req.reference)) {
    throw new Error("Référence Monetico invalide (12 caractères A-Z0-9).");
  }

  const contexte = Buffer.from(
    JSON.stringify({
      billing: {
        addressLine1: req.billingContext.addressLine1,
        city: req.billingContext.city,
        postalCode: req.billingContext.postalCode,
        country: req.billingContext.country,
      },
    }),
    "utf8",
  ).toString("base64");

  const fields: Record<string, string> = {
    TPE: config.tpe,
    version: MONETICO_VERSION,
    date: formatMoneticoDate(req.now ?? new Date()),
    montant: formatMontant(req.amountCents, req.currency ?? "EUR"),
    reference: req.reference,
    lgue: "FR",
    societe: config.societe,
    mail: req.email,
    contexte_commande: contexte,
    url_retour_ok: req.urlRetourOk,
    url_retour_err: req.urlRetourErr,
  };
  if (req.texteLibre) fields["texte-libre"] = req.texteLibre;

  fields["MAC"] = sealFields(fields, config.key);

  return { action: MONETICO_PAYMENT_URLS[config.mode], fields };
}

/* ------------------------------------------------------------
   IPN : parsing du corps form-urlencoded + filtrage à l'ingestion.
   ------------------------------------------------------------ */

/** Corps IPN (request.text()) → champs. */
export function parseIpnBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) fields[k] = v;
  return fields;
}

/**
 * Champs bancaires/personnels à NE JAMAIS journaliser (données carte,
 * IP client, empreintes — conservation limitée et PCI-DSS).
 */
const IPN_EXCLUDED_FIELDS = new Set([
  "MAC",
  "bincb",
  "hpancb",
  "cbmasquee",
  "vld",
  "ipclient",
  "numauto",
  "authentification",
  "veres",
  "pares",
  "status3ds",
  "cbenregistree",
  "modepaiement",
]);

/** Filtre les champs IPN avant journalisation (ipn_events.raw). */
export function filterIpnForStorage(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!IPN_EXCLUDED_FIELDS.has(k)) out[k] = v;
  }
  return out;
}
