import { CREDITOR, creditorIdentityLines } from "@/lib/sepa/creditor";

/* ============================================================
   Texte intégral du mandat de prélèvement SEPA Core.

   C'est CE texte qui fait foi juridiquement : son empreinte
   SHA-256 est archivée en base (pending_signups.mandate_text_sha256,
   sepa_mandates.mandate_text_sha256) et le PDF n'en est qu'un
   rendu. Toute modification du gabarit DOIT incrémenter
   MANDATE_TEXT_VERSION (core-v1 → core-v2…) — les mandats déjà
   signés restent liés à leur version d'origine.

   Les 8 mentions obligatoires du mandat Core :
   1. le titre exact « Mandat de Prélèvement SEPA » ;
   2. l'ICS (Identifiant Créancier SEPA) ;
   3. la RUM (Référence Unique du Mandat) ;
   4. les coordonnées du créancier ;
   5. le type de paiement « Prélèvement récurrent » ;
   6. les modalités de retour/révocation (contact@medicarepro.fr) ;
   7. les coordonnées du débiteur (nom, adresse, IBAN) ;
   8. la mention légale Core imposée mot pour mot.

   ⚠️ IBAN : masqué PARTOUT, y compris dans le PDF archivé.
   L'IBAN complet ne vit que chiffré en base (iban_encrypted).
   ============================================================ */

export const MANDATE_TEXT_VERSION = "core-v1";

export type MandateTextData = {
  /** Référence Unique du Mandat (RUM), ex. MP-2026-0001. */
  rum: string;
  /** Identifiant Créancier SEPA — billingEnv().sepaIcs. */
  ics: string;
  /** Nom du débiteur (cabinet ou praticien). */
  debtorName: string;
  /** Titulaire du compte à débiter. */
  accountHolder: string;
  /** Adresse postale complète du débiteur. */
  debtorAddress: string;
  /** IBAN MASQUÉ (maskIban) — jamais l'IBAN complet ici. */
  ibanMasked: string;
};

/**
 * Mention légale Core, imposée mot pour mot par le rulebook SEPA
 * (traduction officielle française). NE PAS reformuler.
 */
export const CORE_LEGAL_MENTION =
  "En signant ce formulaire de mandat, vous autorisez (A) MEDICARE PRO " +
  "à envoyer des instructions à votre banque pour débiter votre compte, " +
  "et (B) votre banque à débiter votre compte conformément aux " +
  "instructions de MEDICARE PRO. Vous bénéficiez du droit d'être " +
  "remboursé par votre banque selon les conditions décrites dans la " +
  "convention que vous avez passée avec elle. Une demande de " +
  "remboursement doit être présentée dans les 8 semaines suivant la " +
  "date de débit de votre compte pour un prélèvement autorisé.";

export const BANK_RIGHTS_MENTION =
  "Vos droits concernant le présent mandat sont expliqués dans un " +
  "document que vous pouvez obtenir auprès de votre banque.";

/** Texte intégral du mandat Core (version MANDATE_TEXT_VERSION). */
export function mandateText(d: MandateTextData): string {
  return [
    "Mandat de Prélèvement SEPA",
    "",
    `Référence Unique du Mandat (RUM) : ${d.rum}`,
    `Identifiant Créancier SEPA (ICS) : ${d.ics}`,
    "Type de paiement : Prélèvement récurrent",
    "",
    "CRÉANCIER",
    ...creditorIdentityLines(),
    "",
    "DÉBITEUR",
    `Nom : ${d.debtorName}`,
    `Adresse : ${d.debtorAddress}`,
    `Titulaire du compte : ${d.accountHolder}`,
    `IBAN : ${d.ibanMasked}`,
    "",
    CORE_LEGAL_MENTION,
    "",
    BANK_RIGHTS_MENTION,
    "",
    "MODALITÉS DE RÉVOCATION",
    "Vous pouvez révoquer le présent mandat à tout moment en informant " +
      `${CREDITOR.name} par email à ${CREDITOR.contactEmail}, ainsi que ` +
      "votre banque le cas échéant. La révocation prend effet pour les " +
      "prélèvements non encore présentés.",
    "",
    "DONNÉES PERSONNELLES",
    "Les informations contenues dans le présent mandat sont destinées à " +
      `${CREDITOR.name} pour la gestion de vos prélèvements SEPA et ne ` +
      "sont transmises qu'à sa banque. Conformément au RGPD et à la loi " +
      "Informatique et Libertés, vous disposez de droits d'accès, de " +
      "rectification, d'opposition et d'effacement, à exercer auprès de " +
      `${CREDITOR.contactEmail}.`,
  ].join("\n");
}

// mandateTextSha256 vit dans ./mandate-hash.ts (node:crypto) : ce module-ci
// doit rester importable côté client (le tunnel affiche le texte du mandat).
