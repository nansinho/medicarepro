/* ============================================================
   SIRET — arithmétique locale et lecture de l'annuaire public.

   Le SIRET (14 chiffres) et le SIREN (9 chiffres) se vérifient par
   la formule de Luhn : on attrape les fautes de frappe sans dépendre
   d'un service externe. (Exception connue : les SIRET de La Poste
   dérogent à Luhn — hors sujet pour des cabinets de podologie.)

   CE QUE CETTE ARITHMÉTIQUE PERMET, et qui fait tout le guidage de
   saisie : le 9ᵉ chiffre d'un SIREN est SA CLÉ, entièrement déterminée
   par les huit premiers. Donc à 8 chiffres tapés il n'existe qu'UNE
   entreprise possible, et à 7 chiffres il n'en existe que DIX. On peut
   les nommer avant même que le praticien ait fini de taper. Même
   propriété sur les 14 chiffres du SIRET : à 13 tapés, un seul candidat.

   L'annuaire public (recherche-entreprises.api.gouv.fr, gratuit, sans
   clé) ne sait PAS chercher par préfixe : seuls un SIREN ou un SIRET
   exacts répondent. C'est donc nous qui fabriquons les candidats exacts
   à interroger, ce que fait ce module. Aucune dépendance node ici :
   testable et importable partout (le client s'en sert aussi).
   ============================================================ */

/** Premier rang de saisie où le nombre de candidats devient nommable (10). */
export const SUGGEST_MIN_DIGITS = 7;

/**
 * Somme de Luhn d'une suite de chiffres, calculée pour un numéro de
 * longueur finale `totalLength`.
 *
 * Le doublement dépend du rang DEPUIS LA DROITE du numéro complet : on ne
 * peut donc pas sommer un préfixe sans savoir sur quelle longueur il
 * finira (9 pour un SIREN, 14 pour un SIRET). C'est ce paramètre qui
 * permet de calculer une clé avant que le numéro soit complet.
 */
function luhnSum(digits: string, totalLength: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = digits.charCodeAt(i) - 48;
    if ((totalLength - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum;
}

/** Le numéro complet satisfait-il la formule de Luhn ? */
export function luhnValid(digits: string): boolean {
  return luhnSum(digits, digits.length) % 10 === 0;
}

/** Chiffre final qui rendra `prefix` valide sur `totalLength` caractères. */
export function luhnCheckDigit(prefix: string, totalLength: number): number {
  return (10 - (luhnSum(prefix, totalLength) % 10)) % 10;
}

/** Vérification d'un SIRET (14 chiffres exactement). */
export function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret) && luhnValid(siret);
}

/** Vérification d'un SIREN (9 chiffres exactement). */
export function isValidSiren(siren: string): boolean {
  return /^\d{9}$/.test(siren) && luhnValid(siren);
}

/**
 * SIREN complets et plausibles qui commencent par `prefix`.
 *
 * 9 chiffres → lui-même s'il est valide ; 8 → un seul (sa clé est
 * déterminée) ; 7 → dix. En deçà il y en aurait cent ou mille : on rend
 * une liste vide plutôt que d'inonder l'annuaire de requêtes.
 */
export function sirenCandidates(prefix: string): string[] {
  if (!/^\d+$/.test(prefix)) return [];
  if (prefix.length === 9) return isValidSiren(prefix) ? [prefix] : [];
  if (prefix.length === 8) return [prefix + luhnCheckDigit(prefix, 9)];
  if (prefix.length === 7) {
    return Array.from({ length: 10 }, (_, d) => {
      const huit = prefix + d;
      return huit + luhnCheckDigit(huit, 9);
    });
  }
  return [];
}

/**
 * SIRET complets qui commencent par `prefix` (SIREN + début de NIC).
 *
 * Même raisonnement, un cran plus loin : 13 chiffres → un seul candidat,
 * 12 → dix. À 10 ou 11 chiffres il y en aurait cent ou mille, et c'est
 * alors la LISTE DES ÉTABLISSEMENTS de l'entreprise qui affine (elle est
 * déjà connue à ce stade), pas l'énumération.
 */
export function siretCandidates(prefix: string): string[] {
  if (!/^\d+$/.test(prefix) || prefix.length < 10) return [];
  if (!isValidSiren(prefix.slice(0, 9))) return [];
  if (prefix.length === 14) return isValidSiret(prefix) ? [prefix] : [];
  if (prefix.length === 13) return [prefix + luhnCheckDigit(prefix, 14)];
  if (prefix.length === 12) {
    return Array.from({ length: 10 }, (_, d) => {
      const treize = prefix + d;
      return treize + luhnCheckDigit(treize, 14);
    });
  }
  return [];
}

/**
 * SIREN valides à UN CHIFFRE près du numéro fourni.
 *
 * Une clé de Luhn signale la faute sans dire où elle est : il faut donc
 * essayer chaque rang. La formule en laisse passer exactement un par rang
 * (elle tranche les neuf autres), d'où neuf candidats au plus. Aucun ne
 * peut être écarté a priori, et ils sont donc tous interrogés : couper la
 * liste reviendrait à ne pas proposer la bonne correction quand la faute
 * porte sur les derniers rangs, qui sont les plus fréquents.
 */
export function sirenSubstitutionFixes(siren: string): string[] {
  if (!/^\d{9}$/.test(siren)) return [];
  const out: string[] = [];
  for (let i = 0; i < 9; i++) {
    for (let d = 0; d <= 9; d++) {
      const candidat = siren.slice(0, i) + d + siren.slice(i + 1);
      if (candidat !== siren && luhnValid(candidat) && !out.includes(candidat)) {
        out.push(candidat);
      }
    }
  }
  return out;
}

/**
 * SIREN valides obtenus en remettant à l'endroit deux chiffres voisins.
 *
 * L'autre faute de frappe courante. Huit candidats au plus, cherchés
 * seulement quand aucune substitution n'a rien donné.
 */
export function sirenTranspositionFixes(siren: string): string[] {
  if (!/^\d{9}$/.test(siren)) return [];
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const candidat =
      siren.slice(0, i) + siren[i + 1] + siren[i] + siren.slice(i + 2);
    if (candidat !== siren && luhnValid(candidat) && !out.includes(candidat)) {
      out.push(candidat);
    }
  }
  return out;
}

/** Les deux familles de corrections, la plus probable en tête. */
export function sirenTypoFixes(siren: string): string[] {
  const subs = sirenSubstitutionFixes(siren);
  return [
    ...subs,
    ...sirenTranspositionFixes(siren).filter((v) => !subs.includes(v)),
  ];
}

/** Découpage officiel du SIRET à l'affichage : 3 3 3 5 (« 792 492 431 00681 »). */
export function formatSiret(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 14)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Coupe l'affichage d'un SIRET en deux : ce que la personne a déjà tapé,
 * et ce qui reste. L'écran met le premier morceau en gras, si bien qu'on
 * VOIT la part du numéro déjà acquise grandir à chaque frappe.
 */
export function splitSiretMatch(
  siret: string,
  typed: number,
): [string, string] {
  const formatted = formatSiret(siret);
  if (typed <= 0) return ["", formatted];
  let digits = 0;
  let cut = 0;
  for (let i = 0; i < formatted.length && digits < typed; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") digits++;
    cut = i + 1;
  }
  return [formatted.slice(0, cut), formatted.slice(cut)];
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

/** Un établissement proposé à la saisie, tel que l'écran l'affiche. */
export type SiretSuggestion = {
  siret: string;
  name: string;
  /** Voie seule, sans CP ni ville. */
  address?: string;
  postalCode?: string;
  city?: string;
  active: boolean;
  /** Siège social de l'entreprise ? */
  headquarters: boolean;
  /** Activité déclarée en section santé (NAF 86). Simple repère visuel. */
  health: boolean;
  /** Nombre d'établissements de l'entreprise (1 = cabinet unique). */
  establishmentCount: number;
};

type ApiEtablissement = {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  etat_administratif?: string;
  est_siege?: boolean;
  activite_principale?: string;
  liste_enseignes?: string[] | null;
};

type ApiResult = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  nombre_etablissements?: number;
  siege?: ApiEtablissement;
  matching_etablissements?: ApiEtablissement[];
};

/** Capitalise un libellé rendu en MAJUSCULES par l'annuaire. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (m) => m.toUpperCase());
}

/** Voie seule : l'annuaire concatène CP et commune à la fin de `adresse`. */
function streetOf(etab: ApiEtablissement): string {
  const postalCode = etab.code_postal ?? "";
  const commune = etab.libelle_commune ?? "";
  let street = etab.adresse ?? "";
  const suffix = `${postalCode} ${commune}`.trim();
  if (suffix && street.toUpperCase().endsWith(suffix.toUpperCase())) {
    street = street.slice(0, street.length - suffix.length).trim();
  }
  return street;
}

/** Nom affiché : l'enseigne du lieu si elle existe, sinon la raison sociale. */
function labelOf(unit: ApiResult, etab: ApiEtablissement): string {
  const raw =
    etab.liste_enseignes?.[0] ||
    unit.nom_complet ||
    unit.nom_raison_sociale ||
    "";
  return raw ? titleCase(raw) : "Établissement sans nom déclaré";
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

  const street = streetOf(etab);
  const enseigne = etab.liste_enseignes?.[0];
  const rawName = enseigne || unit.nom_complet || unit.nom_raison_sociale || "";

  return {
    found: true,
    name: rawName ? titleCase(rawName) : undefined,
    address: street ? titleCase(street) : undefined,
    postalCode: etab.code_postal || undefined,
    city: etab.libelle_commune ? titleCase(etab.libelle_commune) : undefined,
    active: etab.etat_administratif !== "F",
  };
}

/** Convertit un établissement de l'annuaire en proposition affichable. */
export function toSuggestion(
  unit: ApiResult,
  etab: ApiEtablissement,
): SiretSuggestion | null {
  if (!etab.siret || !/^\d{14}$/.test(etab.siret)) return null;
  const street = streetOf(etab);
  const city = etab.libelle_commune;
  return {
    siret: etab.siret,
    name: labelOf(unit, etab),
    address: street ? titleCase(street) : undefined,
    postalCode: etab.code_postal || undefined,
    city: city ? titleCase(city) : undefined,
    active: etab.etat_administratif !== "F",
    headquarters: etab.est_siege === true,
    health: (etab.activite_principale ?? "").startsWith("86"),
    establishmentCount: unit.nombre_etablissements ?? 1,
  };
}

/**
 * Toutes les propositions tirées d'une réponse `/search`, dédoublonnées :
 * le siège plus, s'ils sont là, les établissements listés.
 */
export function suggestionsFrom(payload: unknown): SiretSuggestion[] {
  const results = (payload as { results?: ApiResult[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: SiretSuggestion[] = [];
  const seen = new Set<string>();
  for (const unit of results) {
    const etabs = [
      ...(unit.matching_etablissements ?? []),
      ...(unit.siege ? [unit.siege] : []),
    ];
    for (const etab of etabs) {
      const suggestion = toSuggestion(unit, etab);
      if (suggestion && !seen.has(suggestion.siret)) {
        seen.add(suggestion.siret);
        out.push(suggestion);
      }
    }
  }
  return out;
}

/**
 * Ordre d'affichage : ouverts avant fermés, santé avant le reste, siège
 * avant les antennes, puis le numéro pour que la liste ne bouge jamais
 * d'un appel à l'autre.
 */
export function rankSuggestions(items: SiretSuggestion[]): SiretSuggestion[] {
  return [...items].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.health !== b.health) return a.health ? -1 : 1;
    if (a.headquarters !== b.headquarters) return a.headquarters ? -1 : 1;
    return a.siret.localeCompare(b.siret);
  });
}
