import { PRICING_VERSION } from "@/lib/checkout/pricing";

/* ============================================================
   Registre des documents contractuels et informatifs.

   Les DOCUMENTS OFFICIELS sont les PDF versionnés hébergés dans
   public/legal/ — ils font foi (fournis par le client, jamais
   retranscrits). Chaque entrée fige la version et l'empreinte
   SHA-256 du fichier : le test registry.test.ts vérifie que le
   fichier servi correspond bien à l'empreinte (toute modification
   d'un PDF DOIT passer par un nouveau fichier versionné + mise à
   jour du registre).

   La preuve de consentement (table consent_records) archive ce
   snapshot {document, version, sha256} + le libellé exact affiché
   — exigence de l'art. 5 des CGV v2.1 (case obligatoire non
   pré-cochée, preuve horodatée : version, identité, date/heure).

   Module CLIENT-SAFE : aucune dépendance node (les sha256 sont
   des constantes), importable par le tunnel pour afficher liens
   et libellé.
   ============================================================ */

export type LegalDocument = {
  /** Identifiant stable (clé de la preuve). */
  key: string;
  /** Titre affiché. */
  title: string;
  /** Version officielle du document. */
  version: string;
  /** Page de présentation sur le site. */
  pageHref: string;
  /** PDF officiel (public/legal/…) — document faisant foi. */
  pdfHref: string;
  /** SHA-256 (hex) du PDF officiel. */
  sha256: string;
};

export const LEGAL_DOCUMENTS = {
  cgv: {
    key: "cgv",
    title: "Conditions Générales de Vente",
    version: "2.1",
    pageHref: "/cgv",
    pdfHref: "/legal/CGV_MedicarePro_v2.1.pdf",
    sha256: "f41cd5dff831e79e5a7e6e214e00c5e2ff3a828819dcc0598c7e64a4e0ec5aad",
  },
  cgu: {
    key: "cgu",
    title: "Conditions Générales d'Utilisation",
    version: "1.0",
    pageHref: "/cgu",
    pdfHref: "/legal/CGU_MedicarePro_v1.0.pdf",
    sha256: "6ab6b75b6e287311ae2cae74c0a5bac15b8178069a80444a7106edf1d724c89d",
  },
  dpa: {
    key: "dpa",
    title: "Accord de Traitement des Données (DPA)",
    version: "2.1",
    pageHref: "/dpa",
    pdfHref: "/legal/DPA_MedicarePro_v2.1.pdf",
    sha256: "33321f07796054b713d7362c94e7c8705aba1e213a1af2932958890ce863c3a2",
  },
  confidentialite: {
    key: "confidentialite",
    title: "Politique de Confidentialité",
    version: "2.1",
    pageHref: "/confidentialite",
    pdfHref: "/legal/Politique_Confidentialite_MedicarePro_v2.1.pdf",
    sha256: "f2bd52ef26135809906ccf93c72d15ebc47544630381f70864b621fc7f8844c6",
  },
  cookies: {
    key: "cookies",
    title: "Politique de Cookies",
    version: "2.1",
    pageHref: "/cookies",
    pdfHref: "/legal/Politique_Cookies_MedicarePro_v2.1.pdf",
    sha256: "8b7369e6c70bae7702b58576749c5626ded25c81b2ce5d9f3b5ef6c1f5674e29",
  },
} as const satisfies Record<string, LegalDocument>;

/**
 * Libellé EXACT de la case de consentement contractuel (fourni par le
 * client — ne pas reformuler). Les segments [«…»] sont rendus en liens
 * par le tunnel ; ce texte brut est archivé tel quel dans la preuve.
 */
export const TERMS_LABEL =
  "J'ai lu et j'accepte les Conditions Générales de Vente, les " +
  "Conditions Générales d'Utilisation, l'Accord de Traitement des " +
  "Données (DPA) et la grille tarifaire en vigueur, et je reconnais " +
  "avoir pris connaissance de la Politique de Confidentialité et de " +
  "la Politique de Cookies.";

export type ConsentDocumentSnapshot = {
  document: string;
  version: string;
  sha256?: string;
};

/**
 * Snapshot des documents couverts par la case de consentement,
 * archivé dans consent_records.documents au moment de l'acceptation.
 * Inclut la grille tarifaire (versionnée, sans PDF : les montants
 * exacts consentis sont figés par ailleurs dans pending_signups/
 * subscriptions).
 */
export function consentDocumentsSnapshot(): ConsentDocumentSnapshot[] {
  return [
    ...Object.values(LEGAL_DOCUMENTS).map((d) => ({
      document: d.key,
      version: d.version,
      sha256: d.sha256,
    })),
    { document: "grille-tarifaire", version: PRICING_VERSION },
  ];
}
