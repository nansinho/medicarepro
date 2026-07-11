import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  consentDocumentsSnapshot,
  LEGAL_DOCUMENTS,
  TERMS_LABEL,
} from "./registry";

/* ============================================================
   Test d'INTÉGRITÉ des documents contractuels (gate de merge).

   Chaque PDF de public/legal/ doit correspondre exactement à
   l'empreinte figée dans le registre : un document modifié sans
   nouveau fichier versionné + bump du registre fait échouer la CI.
   C'est la garantie que la preuve de consentement (sha256 archivé)
   désigne toujours le fichier réellement servi.
   ============================================================ */

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "public");

describe("registre des documents légaux", () => {
  for (const doc of Object.values(LEGAL_DOCUMENTS)) {
    it(`${doc.key} v${doc.version} : le PDF servi correspond à l'empreinte figée`, () => {
      const bytes = readFileSync(join(PUBLIC_DIR, doc.pdfHref));
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(hash).toBe(doc.sha256);
    });

    it(`${doc.key} : le nom de fichier porte la version (immutabilité)`, () => {
      expect(doc.pdfHref).toContain(doc.version.replace(".", "."));
      expect(doc.pdfHref.startsWith("/legal/")).toBe(true);
    });
  }

  it("le libellé de consentement nomme les 4 documents contractuels + les 2 politiques", () => {
    for (const fragment of [
      "Conditions Générales de Vente",
      "Conditions Générales d'Utilisation",
      "Accord de Traitement des Données (DPA)",
      "grille tarifaire en vigueur",
      "Politique de Confidentialité",
      "Politique de Cookies",
    ]) {
      expect(TERMS_LABEL).toContain(fragment);
    }
  });

  it("le snapshot de preuve couvre les 5 PDF + la grille tarifaire versionnée", () => {
    const snapshot = consentDocumentsSnapshot();
    expect(snapshot).toHaveLength(6);
    const keys = snapshot.map((s) => s.document);
    expect(keys).toEqual(
      expect.arrayContaining([
        "cgv",
        "cgu",
        "dpa",
        "confidentialite",
        "cookies",
        "grille-tarifaire",
      ]),
    );
    // Tous les PDF portent une empreinte ; la grille porte une version.
    for (const s of snapshot) {
      expect(s.version).toBeTruthy();
      if (s.document !== "grille-tarifaire") expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
