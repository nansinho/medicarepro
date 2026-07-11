/* ============================================================
   Identité du créancier SEPA — MEDICARE PRO.
   Constantes légales partagées par les documents billing
   (mandats, factures, remises de prélèvements).

   ⚠️ L'ICS (Identifiant Créancier SEPA) n'est PAS une constante :
   il vient de la configuration (billingEnv().sepaIcs) — passez-le
   en paramètre aux fonctions qui en ont besoin.
   ============================================================ */

export const CREDITOR = {
  name: "MEDICARE PRO",
  legalForm: "SAS au capital de 1 000 €",
  addressLine1: "340 chemin du plan marseillais",
  postalCode: "13320",
  city: "Bouc-Bel-Air",
  country: "France",
  siret: "102 034 121 00016",
  rcs: "RCS Aix-en-Provence 102 034 121",
  /** Adresse de contact pour la gestion des mandats (révocation, RGPD…). */
  contactEmail: "contact@medicarepro.fr",
} as const;

/** Adresse postale complète du créancier, sur une ligne. */
export function creditorPostalAddress(): string {
  return `${CREDITOR.addressLine1}, ${CREDITOR.postalCode} ${CREDITOR.city}, ${CREDITOR.country}`;
}

/**
 * Identité légale du créancier (sans l'ICS) — lignes prêtes à
 * afficher dans un document (mandat, facture, courrier).
 */
export function creditorIdentityLines(): string[] {
  return [
    `${CREDITOR.name}, ${CREDITOR.legalForm}`,
    creditorPostalAddress(),
    `SIRET ${CREDITOR.siret} — ${CREDITOR.rcs}`,
  ];
}

/**
 * Bloc « Créancier » complet pour les documents SEPA :
 * identité légale + ICS (fourni par billingEnv().sepaIcs).
 */
export function creditorBlockLines(ics: string): string[] {
  return [
    ...creditorIdentityLines(),
    `Identifiant Créancier SEPA (ICS) : ${ics}`,
  ];
}
