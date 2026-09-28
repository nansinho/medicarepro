/* ============================================================
   Données locales réelles d'une page ville (colonne
   cities.local_data). Sources publiques uniquement :
   · pédicures-podologues : Annuaire Santé (RPPS, ANS), données
     en libre accès, Licence Ouverte ;
   · population municipale : INSEE via geo.api.gouv.fr.
   Aucun chiffre de page ville ne doit venir d'ailleurs : le
   générateur ne reçoit que ceux-ci, le contrôle qualité refuse
   tout autre nombre (cf. src/lib/ai/city-quality.ts).
   ============================================================ */

/** Jeu de données source des effectifs de podologues (data.gouv.fr). */
export const RPPS_DATASET_URL =
  "https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps";

export type CityLocalData = {
  /** Code commune INSEE (Paris, Lyon, Marseille : code de la ville entière). */
  insee: string;
  population: number;
  /** Pédicures-podologues distincts exerçant dans la commune (tous modes). */
  podologues: number;
  /** Dont exercice libéral. */
  podologuesLiberaux: number;
  /** Podologues pour 10 000 habitants (1 décimale), null si population nulle. */
  densite: number | null;
  departement: { code: string; nom: string; podologues: number; population: number; densite: number };
  france: { podologues: number; population: number; densite: number };
  codesPostaux: string[];
  /** Une autre commune porte le même nom : on précise le département partout. */
  homonyme?: boolean;
  sources: {
    /** Date de l'extraction Annuaire Santé utilisée (AAAA-MM-JJ). */
    annuaireSante: string;
    /** Libellé de la source de population. */
    population: string;
  };
};

/** Vrai si la valeur a la forme attendue (garde pour les lectures en base). */
export function isLocalData(value: unknown): value is CityLocalData {
  if (value == null || typeof value !== "object") return false;
  const v = value as CityLocalData;
  return (
    typeof v.insee === "string" &&
    typeof v.population === "number" &&
    typeof v.podologues === "number" &&
    typeof v.departement?.densite === "number" &&
    typeof v.france?.densite === "number"
  );
}

/** Densité pour 10 000 habitants, arrondie à une décimale. */
export function densite(podologues: number, population: number): number | null {
  if (!population) return null;
  return Math.round((podologues / population) * 100_000) / 10;
}

/** 39432 → « 39 432 » (espace insécable fine, typographie française). */
export function formatInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** 4.3 → « 4,3 » ; 4 → « 4 ». */
export function formatDecimal(n: number): string {
  return Number.isInteger(n) ? formatInt(n) : n.toFixed(1).replace(".", ",");
}

/** Nom affiché : « Saint-Denis (974) » pour un homonyme, sinon le nom seul. */
export function cityLabel(name: string, deptCode: string, homonyme?: boolean): string {
  return homonyme ? `${name} (${deptCode})` : name;
}

const TITLE_MAX = 60;
const BRAND = " | MediCare Pro";

/**
 * Titre SEO imposé d'une page ville : une seule cible par page,
 * « logiciel podologue + ville » (intention praticien, pas patient), jamais
 * reprise par une autre page. Marque ajoutée si la longueur le permet.
 */
export function cityTitle(nameLocative: string, deptCode: string, homonyme?: boolean): string {
  const base = `Logiciel podologue ${nameLocative}${homonyme ? ` (${deptCode})` : ""}`;
  return base.length + BRAND.length <= TITLE_MAX ? base + BRAND : base;
}

/** Ancre d'une région sur la page Partout en France (« Île-de-France » → « ile-de-france »). */
export function regionAnchor(region: string): string {
  return region
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** « 26 septembre 2026 » depuis « 2026-09-26 ». */
export function formatSourceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
