import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sirenCandidates } from "./siret";

/* ============================================================
   Moteur de guidage SIRET — annuaire simulé.

   Ce qui est vérifié ici n'est pas la mise en forme mais les deux
   décisions qui engagent : COMBIEN de numéros on va chercher (le
   quota de l'État est étroit), et la différence entre « ce numéro
   n'existe pas » (bloquant) et « je n'ai pas pu savoir » (jamais
   bloquant). Confondre les deux ferait refuser des cabinets réels
   un jour de panne.
   ============================================================ */

type Payload = Record<string, unknown>;

function etablissement(
  siret: string,
  opts: {
    ville?: string;
    cp?: string;
    fermé?: boolean;
    siège?: boolean;
    naf?: string;
    enseigne?: string;
  } = {},
) {
  const ville = opts.ville ?? "AIX-EN-PROVENCE";
  const cp = opts.cp ?? "13100";
  return {
    siret,
    adresse: `12 RUE DE LA REPUBLIQUE ${cp} ${ville}`,
    code_postal: cp,
    libelle_commune: ville,
    etat_administratif: opts.fermé ? "F" : "A",
    est_siege: opts.siège ?? true,
    activite_principale: opts.naf ?? "86.90E",
    liste_enseignes: opts.enseigne ? [opts.enseigne] : null,
  };
}

function unite(
  siren: string,
  opts: {
    nom?: string;
    nbEtablissements?: number;
    siège?: ReturnType<typeof etablissement>;
    etablissements?: ReturnType<typeof etablissement>[];
  } = {},
): Payload {
  return {
    results: [
      {
        siren,
        nom_complet: opts.nom ?? "CABINET DE PODOLOGIE TEST",
        nombre_etablissements: opts.nbEtablissements ?? 1,
        siege: opts.siège ?? etablissement(`${siren}00019`),
        matching_etablissements: opts.etablissements ?? [],
      },
    ],
  };
}

/** Charge le module avec un annuaire simulé (état interne remis à zéro). */
async function avecAnnuaire(
  registre: Record<string, Payload>,
  opts: { panne?: boolean } = {},
) {
  vi.resetModules();
  const appels: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    appels.push(url);
    if (opts.panne) throw new Error("réseau injoignable");
    const q = new URL(url).searchParams.get("q") ?? "";
    const payload = registre[q] ?? { results: [] };
    return { ok: true, json: async () => payload } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  const moteur = await import("./annuaire");
  return { ...moteur, appels, fetchMock };
}

const SIREN = "792492431"; // réel, clé de Luhn vérifiée
const SIRET = "79249243100681";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("suggestSiret — combien de chiffres, combien de candidats", () => {
  it("en deçà de 7 chiffres, ne dérange pas l'annuaire et dit ce qui manque", async () => {
    const { suggestSiret, fetchMock } = await avecAnnuaire({});
    const reply = await suggestSiret("79249");
    expect(reply.status).toBe("need_more");
    expect(reply.need).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(
    "à 7 chiffres, interroge les dix SIREN possibles et ne garde que ceux qui existent",
    async () => {
      const dix = sirenCandidates("7924924");
      const { suggestSiret, fetchMock } = await avecAnnuaire({
        [dix[0]]: unite(dix[0], { nom: "AUTRE SOCIETE" }),
        [SIREN]: unite(SIREN, { nom: "CABINET MARTIN" }),
      });
      const reply = await suggestSiret("7924924");
      expect(fetchMock).toHaveBeenCalledTimes(10);
      expect(reply.status).toBe("ok");
      expect(reply.items).toHaveLength(2);
      expect(reply.items.map((i) => i.siret)).toContain(`${SIREN}00019`);
    },
    20_000,
  );

  it("à 8 chiffres, un seul appel : le numéro complet est déjà proposé", async () => {
    const { suggestSiret, fetchMock } = await avecAnnuaire({
      [SIREN]: unite(SIREN, { nom: "CABINET MARTIN" }),
    });
    const reply = await suggestSiret("79249243");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reply.items).toHaveLength(1);
    expect(reply.items[0].siret).toBe(`${SIREN}00019`);
    expect(reply.items[0].name).toBe("Cabinet Martin");
    expect(reply.items[0].city).toBe("Aix-En-Provence");
  });

  it("ne retient pas une société dont le nom contient ces chiffres", async () => {
    // L'annuaire répond, mais sur une AUTRE unité légale.
    const { suggestSiret } = await avecAnnuaire({
      [SIREN]: unite("111222333", { nom: "MUTUAL'IR 792492431" }),
    });
    const reply = await suggestSiret("79249243");
    expect(reply.items).toEqual([]);
  });

  it("ne redemande rien pour un préfixe déjà vu", async () => {
    const { suggestSiret, fetchMock } = await avecAnnuaire({
      [SIREN]: unite(SIREN),
    });
    await suggestSiret("79249243");
    await suggestSiret("79249243");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("suggestSiret — la clé de Luhn est fausse", () => {
  it("propose les corrections plausibles plutôt qu'une liste vide", async () => {
    const { suggestSiret } = await avecAnnuaire({
      [SIREN]: unite(SIREN, { nom: "CABINET MARTIN" }),
    });
    const reply = await suggestSiret("792492432");
    expect(reply.didYouMean).toBe(true);
    expect(reply.items.map((i) => i.siret)).toEqual([`${SIREN}00019`]);
  });

  it("corrige aussi un SIREN fautif suivi du début du NIC", async () => {
    const { suggestSiret } = await avecAnnuaire({
      [SIREN]: unite(SIREN),
    });
    const reply = await suggestSiret("7924924320001");
    expect(reply.didYouMean).toBe(true);
    expect(reply.items).toHaveLength(1);
  });
});

describe("suggestSiret — affiner sur les établissements (10 à 13 chiffres)", () => {
  const NOM = "CABINET MARTIN";
  const registre = {
    [SIREN]: unite(SIREN, {
      nom: NOM,
      nbEtablissements: 3,
      siège: etablissement(`${SIREN}00019`, { ville: "PARIS", cp: "75001" }),
    }),
    [NOM]: unite(SIREN, {
      nom: NOM,
      nbEtablissements: 3,
      siège: etablissement(`${SIREN}00019`, { ville: "PARIS", cp: "75001" }),
      etablissements: [
        etablissement(`${SIREN}00027`, {
          ville: "LYON",
          cp: "69003",
          siège: false,
        }),
        etablissement(SIRET, {
          ville: "AIX-EN-PROVENCE",
          siège: false,
          enseigne: "PODOLOGIE DU COURS",
        }),
      ],
    }),
  };

  it("ne garde que les établissements qui commencent par les chiffres tapés", async () => {
    const { suggestSiret } = await avecAnnuaire(registre);
    const reply = await suggestSiret(`${SIREN}00`);
    expect(reply.items.map((i) => i.siret).sort()).toEqual([
      `${SIREN}00019`,
      `${SIREN}00027`,
      SIRET,
    ]);

    const affine = await suggestSiret(SIRET.slice(0, 13));
    expect(affine.items.map((i) => i.siret)).toEqual([SIRET]);
    expect(affine.items[0].name).toBe("Podologie Du Cours");
  });

  it("le dit franchement quand aucun établissement ne colle", async () => {
    const { suggestSiret } = await avecAnnuaire(registre);
    const reply = await suggestSiret(`${SIREN}9999`);
    expect(reply.status).toBe("ok");
    expect(reply.items).toEqual([]);
  });
});

describe("panne de l'annuaire — jamais un refus déguisé", () => {
  it("rend « unavailable », et surtout pas une liste vide", async () => {
    const { suggestSiret } = await avecAnnuaire({}, { panne: true });
    const reply = await suggestSiret("79249243");
    expect(reply.status).toBe("unavailable");
    expect(reply.items).toEqual([]);
  });

  it("verifySiret rend « unavailable » sur une panne", async () => {
    const { verifySiret } = await avecAnnuaire({}, { panne: true });
    expect((await verifySiret(SIRET)).status).toBe("unavailable");
  });
});

describe("verifySiret — le verdict qui ouvre ou ferme la porte", () => {
  it("« active » sur un établissement ouvert, avec ses coordonnées", async () => {
    const { verifySiret } = await avecAnnuaire({
      [SIRET]: unite(SIREN, {
        nom: "CABINET MARTIN",
        etablissements: [etablissement(SIRET)],
      }),
    });
    const verdict = await verifySiret(SIRET);
    expect(verdict.status).toBe("active");
    expect(verdict.data?.name).toBe("Cabinet Martin");
    expect(verdict.data?.address).toBe("12 Rue De La Republique");
    expect(verdict.data?.postalCode).toBe("13100");
  });

  it("« closed » sur un établissement fermé", async () => {
    const { verifySiret } = await avecAnnuaire({
      [SIRET]: unite(SIREN, {
        etablissements: [etablissement(SIRET, { fermé: true })],
      }),
    });
    expect((await verifySiret(SIRET)).status).toBe("closed");
  });

  it("« not_found » quand l'annuaire répond et ne connaît pas ce numéro", async () => {
    const { verifySiret } = await avecAnnuaire({});
    expect((await verifySiret(SIRET)).status).toBe("not_found");
  });
});
