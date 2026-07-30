import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
   Routage multi-TPE : le mensuel doit partir du TPE récurrent,
   l'annuel du TPE immédiat, et l'IPN être vérifié avec la clé du
   TPE qui l'a émis. Une erreur ici = mauvais sceau (paiement
   refusé) ou pire, mauvais TPE encaissé.

   On stube billingEnv() pour ne pas dépendre de vraies variables.
   ============================================================ */

const RECURRENT = {
  moneticoTpe: "NB8179R",
  moneticoKey: "KEY_RECURRENT",
  moneticoSociete: "medicarepr",
  moneticoTpeImmediate: "NB8179I",
  moneticoKeyImmediate: "KEY_IMMEDIATE",
  moneticoSocieteImmediate: "medicarepr_im",
  moneticoMode: "test" as const,
};

vi.mock("@/lib/env", () => ({
  billingEnv: () => RECURRENT,
}));

let moneticoConfigForPlan: typeof import("./monetico-routing").moneticoConfigForPlan;
let moneticoKeyForTpe: typeof import("./monetico-routing").moneticoKeyForTpe;

beforeEach(async () => {
  ({ moneticoConfigForPlan, moneticoKeyForTpe } = await import(
    "./monetico-routing"
  ));
});

afterEach(() => vi.clearAllMocks());

describe("moneticoConfigForPlan", () => {
  it("MENSUEL → TPE récurrent", () => {
    const c = moneticoConfigForPlan("MONTHLY");
    expect(c.tpe).toBe("NB8179R");
    expect(c.key).toBe("KEY_RECURRENT");
    expect(c.societe).toBe("medicarepr");
  });

  it("ANNUEL → TPE immédiat", () => {
    const c = moneticoConfigForPlan("ANNUAL");
    expect(c.tpe).toBe("NB8179I");
    expect(c.key).toBe("KEY_IMMEDIATE");
    expect(c.societe).toBe("medicarepr_im");
  });
});

describe("moneticoKeyForTpe", () => {
  it("clé immédiate pour le TPE immédiat", () => {
    expect(moneticoKeyForTpe("NB8179I")).toBe("KEY_IMMEDIATE");
  });

  it("clé récurrente pour le TPE récurrent", () => {
    expect(moneticoKeyForTpe("NB8179R")).toBe("KEY_RECURRENT");
  });

  it("clé récurrente par défaut pour un TPE inconnu", () => {
    expect(moneticoKeyForTpe("NB8179X")).toBe("KEY_RECURRENT");
    expect(moneticoKeyForTpe("")).toBe("KEY_RECURRENT");
  });
});
