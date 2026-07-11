import { describe, expect, it } from "vitest";
import { computeVatBreakdown } from "./invoices";

/* ============================================================
   Tests de la partie PURE de l'émission de facture : la
   décomposition TVA 20 % d'un TTC (HT = round(TTC / 1,2),
   TVA = TTC − HT). Le rendu PDF et l'upload Storage ne se
   testent pas ici (dépendances Supabase).
   ============================================================ */

describe("computeVatBreakdown (TVA 20 %, prix affichés TTC)", () => {
  it("ANNUAL + 2 collaborateurs : 658,08 € TTC → 548,40 € HT + 109,68 € TVA", () => {
    expect(computeVatBreakdown(65808)).toEqual({
      htCents: 54840,
      vatCents: 10968,
      ttcCents: 65808,
    });
  });

  it("MONTHLY sans collaborateur : 29,88 € TTC → 24,90 € HT + 4,98 € TVA", () => {
    expect(computeVatBreakdown(2988)).toEqual({
      htCents: 2490,
      vatCents: 498,
      ttcCents: 2988,
    });
  });

  it("ANNUAL sans collaborateur : 298,08 € TTC", () => {
    expect(computeVatBreakdown(29808)).toEqual({
      htCents: 24840,
      vatCents: 4968,
      ttcCents: 29808,
    });
  });

  it("arrondit le HT au centime le plus proche, la TVA absorbe l'écart", () => {
    // 100 / 1,2 = 83,33… → HT 83, TVA 17
    expect(computeVatBreakdown(100)).toEqual({
      htCents: 83,
      vatCents: 17,
      ttcCents: 100,
    });
    // 101 / 1,2 = 84,17 → HT 84, TVA 17
    expect(computeVatBreakdown(101)).toEqual({
      htCents: 84,
      vatCents: 17,
      ttcCents: 101,
    });
    // 103 / 1,2 = 85,83 → HT 86, TVA 17
    expect(computeVatBreakdown(103)).toEqual({
      htCents: 86,
      vatCents: 17,
      ttcCents: 103,
    });
  });

  it("HT + TVA = TTC pour tous les montants du barème (0 à 20 collab)", () => {
    const amounts: number[] = [];
    for (let n = 0; n <= 20; n += 1) {
      amounts.push(2988 + 1500 * n); // MONTHLY + n collaborateurs
      amounts.push((2484 + 1500 * n) * 12); // ANNUAL + n collaborateurs
    }
    for (const ttc of amounts) {
      const { htCents, vatCents, ttcCents } = computeVatBreakdown(ttc);
      expect(htCents + vatCents).toBe(ttc);
      expect(ttcCents).toBe(ttc);
      expect(vatCents).toBeGreaterThan(0);
    }
  });

  it("zéro : décomposition nulle", () => {
    expect(computeVatBreakdown(0)).toEqual({
      htCents: 0,
      vatCents: 0,
      ttcCents: 0,
    });
  });
});
