import { describe, expect, it } from "vitest";
import {
  checkoutAmountCents,
  formatEuros,
  monthlyPriceCents,
  planFromPlanKey,
  renewalAmountCents,
} from "./pricing";
import { baseInvoicePrefix, invoicePrefixCandidates } from "./invoice-prefix";
import { CheckoutSchema } from "./schema";

describe("pricing (barème CMS : 29,88 / 24,84 / +15,00)", () => {
  it("MONTHLY : mensualité facturée telle quelle", () => {
    expect(checkoutAmountCents("MONTHLY", 0)).toBe(2988);
    expect(checkoutAmountCents("MONTHLY", 1)).toBe(4488);
    expect(checkoutAmountCents("MONTHLY", 2)).toBe(5988);
  });

  it("ANNUAL : douze mensualités en une fois", () => {
    expect(checkoutAmountCents("ANNUAL", 0)).toBe(29808); // 298,08 €
    expect(checkoutAmountCents("ANNUAL", 1)).toBe(47808); // 478,08 €
  });

  it("cas litigieux dev B : ANNUAL + 2 collaborateurs = 65 808 cts (notre lecture)", () => {
    // La doc dev B montre 23 904 cts pour ce cas — INCOHÉRENT avec le CMS.
    // Ce test documente NOTRE barème en attendant leur confirmation écrite.
    expect(checkoutAmountCents("ANNUAL", 2)).toBe(65808);
  });

  it("renouvellement = même formule que le 1er paiement", () => {
    expect(renewalAmountCents("ANNUAL", 2)).toBe(checkoutAmountCents("ANNUAL", 2));
    expect(renewalAmountCents("MONTHLY", 0)).toBe(2988);
  });

  it("borne les collaborateurs (0-20)", () => {
    expect(() => monthlyPriceCents("MONTHLY", -1)).toThrow();
    expect(() => monthlyPriceCents("MONTHLY", 21)).toThrow();
    expect(() => monthlyPriceCents("MONTHLY", 1.5)).toThrow();
    expect(monthlyPriceCents("MONTHLY", 20)).toBe(2988 + 30000);
  });

  it("mapping planKey CMS ↔ plan API", () => {
    expect(planFromPlanKey("monthly")).toBe("MONTHLY");
    expect(planFromPlanKey("annual")).toBe("ANNUAL");
  });

  it("formatEuros", () => {
    expect(formatEuros(65808)).toMatch(/658,08/);
  });
});

describe("invoice-prefix", () => {
  it("initiales des mots significatifs (stop-words ignorés, complétés à 3 min)", () => {
    expect(baseInvoicePrefix("Cabinet Dupont")).toBe("DUPO"); // "Cabinet" est un stop-word
    // [TROIS, VALLEES] → initiales "TV" → complété à 3 : "TVT"
    expect(baseInvoicePrefix("Podologie des Trois Vallées")).toBe("TVT");
  });

  it("un seul mot significatif : premières lettres", () => {
    expect(baseInvoicePrefix("Durand")).toBe("DURA");
    // [LEA, MARIE] → initiales "LM" → complété à 3 : "LML"
    expect(baseInvoicePrefix("Cabinet Léa-Marie")).toBe("LML");
  });

  it("gère accents, vide et noms courts", () => {
    expect(baseInvoicePrefix("Éàü")).toHaveLength(3);
    expect(baseInvoicePrefix("")).toBe("MPC");
    expect(baseInvoicePrefix("A B")).toHaveLength(3);
  });

  it("candidats : base puis suffixes numériques puis aléa", () => {
    const candidates = invoicePrefixCandidates("Cabinet Dupont", 4);
    expect(candidates[0]).toBe("DUPO");
    expect(candidates[1]).toBe("DUPO2");
    expect(candidates[2]).toBe("DUPO3");
    expect(candidates).toHaveLength(5); // 4 déterministes + 1 aléatoire
  });
});

describe("CheckoutSchema (règles du contrat dev B §6)", () => {
  const valid = {
    plan: "ANNUAL",
    extraCollaborators: 2,
    cabinet: {
      name: "Cabinet Dupont",
      email: "contact@cabinet-dupont.fr",
      phone: "0102030405",
      mobilePhone: "0601020304",
      address: "12 rue de la Santé",
      city: "Paris",
      postalCode: "75014",
      siretNumber: "12345678901234",
      rppsNumber: "12345678901",
    },
    user: {
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean.dupont@cabinet-dupont.fr",
      password: "MotDePasse123",
    },
    sepa: {
      iban: "FR76 3000 6000 0112 3456 7890 189",
      accountHolder: "Cabinet Dupont",
    },
    cgvAccepted: true,
    mandateAccepted: true,
    turnstileToken: "tok",
  };

  it("accepte un dossier complet et normalise l'IBAN", () => {
    const parsed = CheckoutSchema.parse(valid);
    expect(parsed.sepa.iban).toBe("FR7630006000011234567890189"); // espaces retirés
    expect(parsed.cabinet.siretNumber).toBe("12345678901234");
    expect(parsed.website).toBe("");
  });

  it("rejette mot de passe faible, CP invalide, SIRET invalide, IBAN invalide", () => {
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        user: { ...valid.user, password: "faible" },
      }).success,
    ).toBe(false);
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        cabinet: { ...valid.cabinet, postalCode: "7501" },
      }).success,
    ).toBe(false);
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        cabinet: { ...valid.cabinet, siretNumber: "123" },
      }).success,
    ).toBe(false);
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        sepa: { ...valid.sepa, iban: "FR7630006000011234567890000" },
      }).success,
    ).toBe(false);
  });

  it("SIRET vide → undefined (optionnel côté contrat)", () => {
    const parsed = CheckoutSchema.parse({
      ...valid,
      cabinet: { ...valid.cabinet, siretNumber: "" },
    });
    expect(parsed.cabinet.siretNumber).toBeUndefined();
  });

  it("exige les deux consentements distincts", () => {
    expect(
      CheckoutSchema.safeParse({ ...valid, cgvAccepted: false }).success,
    ).toBe(false);
    expect(
      CheckoutSchema.safeParse({ ...valid, mandateAccepted: false }).success,
    ).toBe(false);
  });
});
