import { describe, expect, it } from "vitest";
import {
  extractEtablissement,
  formatSiret,
  isValidSiren,
  isValidSiret,
  luhnCheckDigit,
  rankSuggestions,
  sirenCandidates,
  sirenTypoFixes,
  siretCandidates,
  splitSiretMatch,
  suggestionsFrom,
  type SiretSuggestion,
} from "./siret";

/* Numéros RÉELS relevés dans l'annuaire des entreprises le 06/08/2026 :
   les propriétés testées ici (clé de Luhn du SIREN, unicité du candidat)
   ne valent que si elles tiennent sur de vrais numéros. */
const SIREN_REEL = "792492431";
const SIRET_REEL = "79249243100681";

describe("isValidSiret (Luhn)", () => {
  it("accepte un SIRET valide", () => {
    // Exemple canonique INSEE (Luhn OK).
    expect(isValidSiret("73282932000074")).toBe(true);
    expect(isValidSiret(SIRET_REEL)).toBe(true);
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

describe("isValidSiren", () => {
  it("accepte des SIREN réels", () => {
    for (const siren of [
      SIREN_REEL,
      "384457388",
      "823120241",
      "493318661",
      "902890292",
    ]) {
      expect(isValidSiren(siren)).toBe(true);
    }
  });

  it("refuse un chiffre altéré et les mauvaises longueurs", () => {
    expect(isValidSiren("792492432")).toBe(false);
    expect(isValidSiren("79249243")).toBe(false);
    expect(isValidSiren("7924924311")).toBe(false);
  });
});

describe("luhnCheckDigit", () => {
  it("retrouve la clé d'un SIREN et celle d'un SIRET", () => {
    expect(luhnCheckDigit("79249243", 9)).toBe(1);
    expect(luhnCheckDigit(SIRET_REEL.slice(0, 13), 14)).toBe(1);
  });
});

describe("sirenCandidates — c'est ce qui rend le guidage possible", () => {
  it("à 8 chiffres, un seul SIREN est possible", () => {
    expect(sirenCandidates("79249243")).toEqual([SIREN_REEL]);
  });

  it("à 7 chiffres, exactement dix, tous valides et tous préfixés", () => {
    const dix = sirenCandidates("7924924");
    expect(dix).toHaveLength(10);
    expect(new Set(dix).size).toBe(10);
    expect(dix).toContain(SIREN_REEL);
    for (const c of dix) {
      expect(c.startsWith("7924924")).toBe(true);
      expect(isValidSiren(c)).toBe(true);
    }
  });

  it("à 9 chiffres, lui-même s'il est valide, rien sinon", () => {
    expect(sirenCandidates(SIREN_REEL)).toEqual([SIREN_REEL]);
    expect(sirenCandidates("792492432")).toEqual([]);
  });

  it("en deçà de 7 chiffres, on n'énumère rien", () => {
    expect(sirenCandidates("792492")).toEqual([]);
    expect(sirenCandidates("")).toEqual([]);
    expect(sirenCandidates("79a4924")).toEqual([]);
  });
});

describe("siretCandidates", () => {
  it("à 13 chiffres, un seul SIRET possible", () => {
    expect(siretCandidates(SIRET_REEL.slice(0, 13))).toEqual([SIRET_REEL]);
  });

  it("à 12 chiffres, dix candidats valides", () => {
    const dix = siretCandidates(SIRET_REEL.slice(0, 12));
    expect(dix).toHaveLength(10);
    expect(dix).toContain(SIRET_REEL);
    for (const c of dix) expect(isValidSiret(c)).toBe(true);
  });

  it("ne propose rien quand le SIREN de tête est déjà faux", () => {
    expect(siretCandidates("7924924320012")).toEqual([]);
  });

  it("à 10 ou 11 chiffres, l'énumération n'a plus de sens", () => {
    expect(siretCandidates(SIRET_REEL.slice(0, 10))).toEqual([]);
    expect(siretCandidates(SIRET_REEL.slice(0, 11))).toEqual([]);
  });
});

describe("sirenTypoFixes", () => {
  it("retrouve le bon numéro derrière un chiffre altéré", () => {
    expect(sirenTypoFixes("792492432")).toContain(SIREN_REEL);
    expect(sirenTypoFixes("702492431")).toContain(SIREN_REEL);
  });

  it("retrouve le bon numéro derrière deux chiffres intervertis", () => {
    // 792492431 tapé « 794292431 » (les 2 et 4 du milieu inversés).
    expect(sirenTypoFixes("794292431")).toContain(SIREN_REEL);
  });

  it("ne se propose jamais lui-même et reste court", () => {
    const fixes = sirenTypoFixes("792492432");
    expect(fixes).not.toContain("792492432");
    expect(fixes.length).toBeLessThanOrEqual(17);
    for (const f of fixes) expect(isValidSiren(f)).toBe(true);
  });
});

describe("formatSiret / splitSiretMatch", () => {
  it("découpe le numéro comme l'INSEE l'écrit", () => {
    expect(formatSiret(SIRET_REEL)).toBe("792 492 431 00681");
    expect(formatSiret("7924")).toBe("792 4");
  });

  it("sépare ce qui est tapé de ce qui reste", () => {
    expect(splitSiretMatch(SIRET_REEL, 8)).toEqual(["792 492 43", "1 00681"]);
    expect(splitSiretMatch(SIRET_REEL, 0)).toEqual(["", "792 492 431 00681"]);
    expect(splitSiretMatch(SIRET_REEL, 14)).toEqual([
      "792 492 431 00681",
      "",
    ]);
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

describe("suggestionsFrom", () => {
  const payload = {
    results: [
      {
        nom_complet: "CABINET DUPONT",
        nombre_etablissements: 2,
        siege: {
          siret: "73282932000015",
          adresse: "1 AVENUE DU SIEGE 75001 PARIS",
          code_postal: "75001",
          libelle_commune: "PARIS",
          etat_administratif: "A",
          est_siege: true,
          activite_principale: "86.90E",
        },
        matching_etablissements: [
          {
            siret: "73282932000074",
            adresse: "12 RUE DE LA REPUBLIQUE 13100 AIX-EN-PROVENCE",
            code_postal: "13100",
            libelle_commune: "AIX-EN-PROVENCE",
            etat_administratif: "F",
            est_siege: false,
            activite_principale: "68.20B",
            liste_enseignes: ["PODOLOGIE DU COURS"],
          },
        ],
      },
    ],
  };

  it("rend le siège et les établissements, sans doublon", () => {
    const items = suggestionsFrom(payload);
    expect(items.map((i) => i.siret).sort()).toEqual([
      "73282932000015",
      "73282932000074",
    ]);
  });

  it("préfère l'enseigne du lieu à la raison sociale", () => {
    const antenne = suggestionsFrom(payload).find(
      (i) => i.siret === "73282932000074",
    );
    expect(antenne?.name).toBe("Podologie Du Cours");
    expect(antenne?.city).toBe("Aix-En-Provence");
    expect(antenne?.active).toBe(false);
    expect(antenne?.health).toBe(false);
    expect(antenne?.establishmentCount).toBe(2);
  });

  it("marque le siège et l'activité de santé", () => {
    const siege = suggestionsFrom(payload).find(
      (i) => i.siret === "73282932000015",
    );
    expect(siege?.headquarters).toBe(true);
    expect(siege?.health).toBe(true);
  });

  it("ne jette pas sur une réponse inattendue", () => {
    expect(suggestionsFrom(null)).toEqual([]);
    expect(suggestionsFrom({ results: "nope" })).toEqual([]);
    expect(suggestionsFrom({ results: [{ siege: { siret: "abc" } }] })).toEqual(
      [],
    );
  });
});

describe("rankSuggestions", () => {
  const base: SiretSuggestion = {
    siret: "00000000000000",
    name: "X",
    active: true,
    headquarters: false,
    health: false,
    establishmentCount: 1,
  };

  it("montre les ouverts puis la santé, et ne bouge pas d'un appel à l'autre", () => {
    const items: SiretSuggestion[] = [
      { ...base, siret: "11111111111111" },
      { ...base, siret: "22222222222222", active: false, health: true },
      { ...base, siret: "33333333333333", health: true },
      { ...base, siret: "44444444444444", health: true, headquarters: true },
    ];
    const ordre = rankSuggestions(items).map((i) => i.siret);
    expect(ordre).toEqual([
      "44444444444444", // ouvert, santé, siège
      "33333333333333", // ouvert, santé
      "11111111111111", // ouvert
      "22222222222222", // fermé
    ]);
    expect(rankSuggestions(items).map((i) => i.siret)).toEqual(ordre);
  });
});
