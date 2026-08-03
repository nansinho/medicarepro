import "server-only";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";

/* ============================================================
   Lien de renouvellement de l'offre annuelle.

   Le jeton est l'identifiant de la souscription CHIFFRÉ (AES-GCM,
   même mécanisme que les secrets du checkout), scellé par l'AAD
   « renewal-link ». Résultat : opaque (ne fuite pas l'id), infalsifiable
   (toute altération casse le déchiffrement), et inutilisable ailleurs
   (l'AAD le cantonne au renouvellement). Aucun secret nouveau.
   ============================================================ */

const RENEWAL_AAD = "renewal-link";

/** Jeton opaque pour le lien de renouvellement d'une souscription. */
export function signRenewalToken(subscriptionId: string): string {
  return encryptSecret(subscriptionId, RENEWAL_AAD);
}

/** Rend l'id de souscription si le jeton est valide, sinon null. */
export function verifyRenewalToken(token: string): string | null {
  try {
    const id = decryptSecret(token, RENEWAL_AAD);
    // UUID attendu : garde-fou minimal contre un jeton déchiffré mais absurde.
    return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** URL complète du lien de renouvellement (pour l'email de rappel). */
export function buildRenewalUrl(subscriptionId: string): string {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/renouvellement?t=${encodeURIComponent(signRenewalToken(subscriptionId))}`;
}

/* Référence Monetico : 12 caractères Crockford, préfixe MP (comme le
   checkout). Copie locale volontaire — on ne touche pas au chemin de
   paiement en production pour ajouter le renouvellement. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newRenewalReference(): string {
  const bytes = randomBytes(10);
  let out = "MP";
  for (let i = 0; i < 10; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}
