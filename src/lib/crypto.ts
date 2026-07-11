import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/* ============================================================
   Chiffrement des secrets au repos — AES-256-GCM, multi-clés.

   Contrat unique du projet (plan billing, arbitrage A4) :
   - Clés : ENCRYPTION_KEYS="v1:<base64 32 octets>[,v2:…]" ;
     la clé de chiffrement courante est ENCRYPTION_ACTIVE_KEY_ID.
   - Format du payload : "<keyId>:base64(iv[12] || tag[16] || ct)".
   - AAD OBLIGATOIRE : lie le secret à son enregistrement
     (monetico_reference pour password_enc/sepa_payload_enc,
     RUM pour iban_encrypted) — un payload recopié sur une autre
     ligne ne se déchiffre pas.
   - Rotation : chiffrer = toujours la clé active ; déchiffrer =
     la clé désignée par le keyId du payload. Retirer une clé =
     re-chiffrer les payloads restants puis la supprimer de l'env
     (crypto-shredding : détruire la clé rend les données mortes).

   RÈGLE : ne JAMAIS logger clés, payloads ou textes en clair.
   ============================================================ */

const IV_LENGTH = 12; // recommandation GCM
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

export type EncryptionKeys = {
  /** keyId → clé de 32 octets. */
  keys: Map<string, Buffer>;
  /** keyId utilisé pour chiffrer. */
  activeKeyId: string;
};

/**
 * Parse "v1:<base64>[,v2:<base64>…]" en table de clés.
 * @throws si une clé est absente, mal encodée ou n'a pas 32 octets.
 */
export function parseEncryptionKeys(
  raw: string,
  activeKeyId: string,
): EncryptionKeys {
  const keys = new Map<string, Buffer>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(":");
    if (sep <= 0) {
      throw new Error(`ENCRYPTION_KEYS : entrée invalide (attendu "id:base64").`);
    }
    const id = trimmed.slice(0, sep);
    const key = Buffer.from(trimmed.slice(sep + 1), "base64");
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEYS : la clé "${id}" doit faire ${KEY_LENGTH} octets (base64).`,
      );
    }
    keys.set(id, key);
  }
  if (keys.size === 0) {
    throw new Error("ENCRYPTION_KEYS : aucune clé fournie.");
  }
  if (!keys.has(activeKeyId)) {
    throw new Error(
      `ENCRYPTION_ACTIVE_KEY_ID "${activeKeyId}" absent de ENCRYPTION_KEYS.`,
    );
  }
  return { keys, activeKeyId };
}

/** Chiffre un secret avec la clé active. AAD obligatoire (non vide). */
export function encryptWithKeys(
  plaintext: string,
  aad: string,
  { keys, activeKeyId }: EncryptionKeys,
): string {
  if (!aad) throw new Error("AAD obligatoire pour le chiffrement.");
  const key = keys.get(activeKeyId);
  if (!key) throw new Error(`Clé de chiffrement "${activeKeyId}" introuvable.`);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${activeKeyId}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

/**
 * Déchiffre un payload "<keyId>:base64(iv||tag||ct)" avec le même AAD.
 * @throws si keyId inconnu, AAD différent ou payload altéré.
 */
export function decryptWithKeys(
  payload: string,
  aad: string,
  { keys }: EncryptionKeys,
): string {
  if (!aad) throw new Error("AAD obligatoire pour le déchiffrement.");
  const sep = payload.indexOf(":");
  if (sep <= 0) throw new Error("Payload chiffré invalide (keyId absent).");

  const keyId = payload.slice(0, sep);
  const key = keys.get(keyId);
  if (!key) throw new Error(`Clé de déchiffrement "${keyId}" introuvable.`);

  const blob = Buffer.from(payload.slice(sep + 1), "base64");
  if (blob.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Payload chiffré invalide (tronqué).");
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ct = blob.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/* ------------------------------------------------------------
   Variante branchée sur l'environnement (usage applicatif).
   ------------------------------------------------------------ */

let cachedKeys: EncryptionKeys | null = null;

function envKeys(): EncryptionKeys {
  if (!cachedKeys) {
    const raw = process.env.ENCRYPTION_KEYS;
    if (!raw) {
      throw new Error(
        "ENCRYPTION_KEYS manquant — le module billing ne peut pas démarrer.",
      );
    }
    cachedKeys = parseEncryptionKeys(
      raw,
      process.env.ENCRYPTION_ACTIVE_KEY_ID ?? "v1",
    );
  }
  return cachedKeys;
}

/** Chiffre un secret (clé active de l'environnement). */
export function encryptSecret(plaintext: string, aad: string): string {
  return encryptWithKeys(plaintext, aad, envKeys());
}

/** Déchiffre un secret chiffré par encryptSecret. */
export function decryptSecret(payload: string, aad: string): string {
  return decryptWithKeys(payload, aad, envKeys());
}

/* ------------------------------------------------------------
   Comparaison à temps constant (tokens, signatures hex/base64).
   timingSafeEqual jette si les longueurs diffèrent : on compare
   d'abord les longueurs (l'égalité de longueur n'est pas un
   secret pour nos usages — tokens de taille fixe).
   ------------------------------------------------------------ */

/** Égalité à temps constant de deux chaînes (UTF-8). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
