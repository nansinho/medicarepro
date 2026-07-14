import { describe, expect, it } from "vitest";
import { isValidSiret, extractEtablissement } from "./siret";

describe("isValidSiret (Luhn)", () => {
  it("accepte un SIRET valide", () => {
    // Exemple canonique INSEE (Luhn OK).
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("refuse une faute de frappe (dernier chiffre altéré)", () => {
    expect(isValidSiret("73282932000075")).toBe(false);
  });

  it("refuse une inversion de chiffres adjacents", () => {
    expect(isValidSiret("73282923000074")).toBe(false);
  });

  it("refuse les formats invalides", () => {
    expect(isValidSiret("")).toBe(false);
    expect(isValidSiret("1234")).toBe(false);
    expect(isValidSiret("7328293200007A")).toBe(false);
    expect(isValidSiret("732829320000740")).toBe(false);
  });
});

describe("extractEtablissement", () => {
  const SIRET = "73282932000074";
  const payload = {
    results: [
      {
        nom_complet: "CABINET DUPONT",
        nom_raison_sociale: "CABINET DUPONT SARL",
        siege: {
          siret: "73282932000015",
          adresse: "1 AVENUE DU SIEGE 75001 PARIS",
          code_postal: "75001",
          libelle_commune: "PARIS",
          etat_administratif: "A",
        },
        matching_etablissements: [
          {
            siret: SIRET,
            adresse: "12 RUE DE LA REPUBLIQUE 13100 AIX-EN-PROVENCE",
            code_postal: "13100",
            libelle_commune: "AIX-EN-PROVENCE",
            etat_administratif: "A",
            liste_enseignes: null,
          },
        ],
      },
    ],
  };

  it("retourne l'établissement exact du SIRET, voie séparée du CP/ville", () => {
    const out = extractEtablissement(payload, SIRET);
    expect(out.found).toBe(true);
    expect(out.name).toBe("Cabinet Dupont");
    expect(out.address).toBe("12 Rue De La Republique");
    expect(out.postalCode).toBe("13100");
    expect(out.city).toBe("Aix-En-Provence");
    expect(out.active).toBe(true);
  });

  it("retombe sur le siège si c'est lui qui porte le SIRET", () => {
    const out = extractEtablissement(payload, "73282932000015");
    expect(out.found).toBe(true);
    expect(out.address).toBe("1 Avenue Du Siege");
    expect(out.city).toBe("Paris");
  });

  it("found=false si aucun établissement ne porte ce SIRET", () => {
    expect(extractEtablissement(payload, "11111111111111").found).toBe(false);
    expect(extractEtablissement({ results: [] }, SIRET).found).toBe(false);
    expect(extractEtablissement(null, SIRET).found).toBe(false);
  });

  it("signale un établissement fermé (etat_administratif = F)", () => {
    const closed = {
      results: [
        {
          nom_complet: "ANCIEN CABINET",
          matching_etablissements: [
            {
              siret: SIRET,
              adresse: "3 RUE X 13100 AIX-EN-PROVENCE",
              code_postal: "13100",
              libelle_commune: "AIX-EN-PROVENCE",
              etat_administratif: "F",
            },
          ],
        },
      ],
    };
    expect(extractEtablissement(closed, SIRET).active).toBe(false);
  });
});
