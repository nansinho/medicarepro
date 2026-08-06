import { describe, expect, it } from "vitest";
import {
  checkoutAmountCents,
  formatEuros,
  monthlyPriceCents,
  planFromPlanKey,
  renewalAmountCents,
  MAX_EXTRA_COLLABORATORS,
  instalmentAmountsCents,
  instalmentsAvailable,
  INSTALMENT_COUNT,
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

  /* Il n'y a plus de maximum COMMERCIAL de collaborateurs (confirmé par le
     client le 05/08/2026) : le plafond restant est un garde-fou de saisie
     contre un nombre absurde posté à la main. Le test porte donc sur la borne
     effective, pas sur une valeur figée. */
  it("borne les collaborateurs (0 à MAX_EXTRA_COLLABORATORS)", () => {
    expect(() => monthlyPriceCents("MONTHLY", -1)).toThrow();
    expect(() =>
      monthlyPriceCents("MONTHLY", MAX_EXTRA_COLLABORATORS + 1),
    ).toThrow();
    expect(() => monthlyPriceCents("MONTHLY", 1.5)).toThrow();
    expect(monthlyPriceCents("MONTHLY", 20)).toBe(2988 + 30000);
    /* 25 collaborateurs : refusé jusqu'au 05/08/2026, ce qui perdait la vente
       d'un cabinet plus grand que la grille ne l'avait prévu. */
    expect(monthlyPriceCents("MONTHLY", 25)).toBe(2988 + 25 * 1500);
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
      siretNumber: "73282932000074", // Luhn valide (exemple INSEE)
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
    termsAccepted: true,
    mandateAccepted: true,
    turnstileToken: "tok",
  };

  it("accepte un dossier complet et normalise l'IBAN", () => {
    const parsed = CheckoutSchema.parse(valid);
    expect(parsed.sepa?.iban).toBe("FR7630006000011234567890189"); // espaces retirés
    expect(parsed.cabinet.siretNumber).toBe("73282932000074");
    expect(parsed.website).toBe("");
  });

  it("accepte un dossier SANS bloc SEPA (étape mandat coupée)", () => {
    const { sepa: _sepa, mandateAccepted: _m, ...noSepa } = valid;
    const parsed = CheckoutSchema.safeParse(noSepa);
    expect(parsed.success).toBe(true);
  });

  it("accepte un téléphone fixe vide (facultatif)", () => {
    const parsed = CheckoutSchema.safeParse({
      ...valid,
      cabinet: { ...valid.cabinet, phone: "" },
    });
    expect(parsed.success).toBe(true);
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

  it("SIRET obligatoire (exigence client 14/07/2026) et contrôlé par Luhn", () => {
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        cabinet: { ...valid.cabinet, siretNumber: "" },
      }).success,
    ).toBe(false);
    // 14 chiffres mais somme de Luhn fausse (faute de frappe simulée).
    expect(
      CheckoutSchema.safeParse({
        ...valid,
        cabinet: { ...valid.cabinet, siretNumber: "73282932000075" },
      }).success,
    ).toBe(false);
  });

  it("RPPS : obligatoire, 11 chiffres", () => {
    /* L'API de provisioning le refuse absent (HTTP 400) : l'accepter vide
       revenait à encaisser un client dont le compte ne pouvait pas être
       créé. Ce test verrouille la règle côté tunnel. */
    for (const bad of ["", "123", "123456789012", "1234567890A"]) {
      expect(
        CheckoutSchema.safeParse({
          ...valid,
          cabinet: { ...valid.cabinet, rppsNumber: bad },
        }).success,
      ).toBe(false);
    }
  });

  it("exige toujours le consentement contractuel (termsAccepted)", () => {
    expect(
      CheckoutSchema.safeParse({ ...valid, termsAccepted: false }).success,
    ).toBe(false);
  });

  it("mandateAccepted est optionnel au niveau schéma (validé par la route selon le flag SEPA)", () => {
    // Le schéma accepte l'absence : c'est la route qui exige le mandat
    // uniquement quand CHECKOUT_SEPA_ENABLED est actif.
    expect(
      CheckoutSchema.safeParse({ ...valid, mandateAccepted: false }).success,
    ).toBe(true);
  });
});

/* ============================================================
   Découpage en versements.

   La somme des versements DOIT valoir le prix annoncé, au centime. Un arrondi
   qui perd un centime le perd sur chaque contrat échelonné, et l'écart se
   découvre au rapprochement comptable, des mois plus tard.
   ============================================================ */
describe("instalmentAmountsCents", () => {
  it("tombe juste sur le tarif du titulaire seul", () => {
    expect(instalmentAmountsCents(29808)).toEqual([9936, 9936, 9936]);
  });

  it("rend toujours exactement le total, quel que soit le nombre de collaborateurs", () => {
    for (let collab = 0; collab <= 30; collab += 1) {
      const total = checkoutAmountCents("ANNUAL", collab);
      const parts = instalmentAmountsCents(total);
      expect(parts).toHaveLength(INSTALMENT_COUNT);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p > 0)).toBe(true);
    }
  });

  /* Le reste va sur le PREMIER versement : celui qui est encaissé sous les yeux
     du praticien, pas sur un prélèvement qu'il découvrirait seul. */
  it("met le reste de la division sur le premier versement", () => {
    expect(instalmentAmountsCents(100)).toEqual([34, 33, 33]);
    expect(instalmentAmountsCents(101)).toEqual([35, 33, 33]);
    expect(instalmentAmountsCents(99)).toEqual([33, 33, 33]);
  });

  it("refuse un montant qui n'est pas un entier positif", () => {
    expect(() => instalmentAmountsCents(0)).toThrow();
    expect(() => instalmentAmountsCents(-300)).toThrow();
    expect(() => instalmentAmountsCents(99.5)).toThrow();
  });

  /* Découper 29,88 € en trois produirait des versements de dix euros pour un
     coût de traitement identique : le mensuel est déjà un étalement. */
  it("n'ouvre l'échelonnement que sur l'offre 12 mois", () => {
    expect(instalmentsAvailable("ANNUAL")).toBe(true);
    expect(instalmentsAvailable("MONTHLY")).toBe(false);
  });
});

/* Le drapeau d'échelonnement ne doit basculer que sur un VRAI booléen : avec
   une coercition, la chaîne « false » vaut Boolean("false") === true, et un
   dossier posté à la main ouvrirait un échéancier qu'aucun écran n'a proposé. */
describe("CheckoutSchema — drapeau d'échelonnement", () => {
  const champ = CheckoutSchema.shape.instalments;
  it("accepte les booléens et rien d'autre", () => {
    expect(champ.parse(true)).toBe(true);
    expect(champ.parse(false)).toBe(false);
    expect(champ.parse(undefined)).toBe(false);
  });
  it("refuse les chaînes, y compris celles qui ressemblent à un refus", () => {
    for (const v of ["false", "non", "0", "true", 1]) {
      expect(() => champ.parse(v)).toThrow();
    }
  });
});
