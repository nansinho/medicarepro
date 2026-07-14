/* ============================================================
   SIRET — validation locale et lecture de l'annuaire public.

   Le SIRET (14 chiffres) se vérifie par la formule de Luhn : on
   attrape les fautes de frappe sans dépendre d'un service externe.
   (Exception connue : les SIRET de La Poste dérogent à Luhn — hors
   sujet pour des cabinets de podologie.)

   L'auto-remplissage interroge l'API Recherche d'entreprises de
   l'État (recherche-entreprises.api.gouv.fr — gratuite, sans clé) ;
   `extractEtablissement` isole l'établissement exact du SIRET dans
   la réponse. Module sans dépendance node : testable et importable
   partout.
   ============================================================ */

/** Vérification Luhn d'un SIRET (14 chiffres exactement). */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = siret.charCodeAt(i) - 48;
    // Positions paires depuis la droite non doublées ; ici l'index
    // gauche pair correspond à une position impaire depuis la droite.
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Coordonnées d'un établissement, prêtes à pré-remplir le tunnel. */
export type SiretLookupResult = {
  found: boolean;
  /** Raison sociale ou enseigne. */
  name?: string;
  /** Adresse (voie seule, sans CP ni ville). */
  address?: string;
  postalCode?: string;
  city?: string;
  /** false = établissement administrativement fermé. */
  active?: boolean;
};

type ApiEtablissement = {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  etat_administratif?: string;
  liste_enseignes?: string[] | null;
};

type ApiResult = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: ApiEtablissement;
  matching_etablissements?: ApiEtablissement[];
};

/** Capitalise un libellé rendu en MAJUSCULES par l'annuaire. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (m) => m.toUpperCase());
}

/**
 * Extrait de la réponse `/search?q=<siret>` l'établissement portant
 * exactement ce SIRET (l'API matche aussi sur le siège).
 */
export function extractEtablissement(
  payload: unknown,
  siret: string,
): SiretLookupResult {
  const results = (payload as { results?: ApiResult[] } | null)?.results;
  if (!Array.isArray(results) || results.length === 0) return { found: false };

  const unit = results[0];
  const etab =
    unit.matching_etablissements?.find((e) => e.siret === siret) ??
    (unit.siege?.siret === siret ? unit.siege : undefined);
  if (!etab) return { found: false };

  const postalCode = etab.code_postal ?? "";
  const commune = etab.libelle_commune ?? "";

  // `adresse` est complète (« 12 RUE X 13100 AIX-EN-PROVENCE ») :
  // on retire le suffixe CP + commune pour ne garder que la voie.
  let street = etab.adresse ?? "";
  const suffix = `${postalCode} ${commune}`.trim();
  if (suffix && street.toUpperCase().endsWith(suffix.toUpperCase())) {
    street = street.slice(0, street.length - suffix.length).trim();
  }

  const enseigne = etab.liste_enseignes?.[0];
  const rawName = enseigne || unit.nom_complet || unit.nom_raison_sociale || "";

  return {
    found: true,
    name: rawName ? titleCase(rawName) : undefined,
    address: street ? titleCase(street) : undefined,
    postalCode: postalCode || undefined,
    city: commune ? titleCase(commune) : undefined,
    active: etab.etat_administratif !== "F",
  };
}
