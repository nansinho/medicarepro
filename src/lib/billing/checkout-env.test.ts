import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
   Garde de configuration d'encaissement.

   Ce que ces tests protègent : l'offre 12 mois ne doit jamais partir sur un
   code site Monetico dont on ignore la fréquence. Si le code site porte le
   rythme (une des deux affirmations contradictoires de .env.example), une
   commande annuelle émise avec le code site mensuel est prélevée 298,08 €
   CHAQUE MOIS. On exige donc une déclaration explicite, et on signale le cas
   « deux formules, un seul code site » au back-office.
   ============================================================ */

const BASE_ENV = {
  NEXT_PUBLIC_SITE_URL: "https://medicarepro.fr",
  MONETICO_TPE: "NB8179R",
  MONETICO_SOCIETE: "medicarepr",
  MONETICO_KEY_TEST: "0".repeat(40),
  MONETICO_MODE: "test",
  MONETICO_TPE_IMMEDIATE: "NB8179I",
  PROVISIONING_API_URL: "https://app.medicarepro.fr/api/provisioning",
  PROVISIONING_API_KEY: "clé-de-test",
  ENCRYPTION_KEYS: "v1:kQwuPSJxHdPKiuAsJP9czsDgs9BCpsTxDN0ryZqaWSM=",
  TURNSTILE_SECRET_KEY: "secret-de-test",
} as const;

/** Charge un module env neuf (il met sa validation en cache au 1er appel). */
async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) {
    process.env[k] = v;
  }
  return import("@/lib/env");
}

beforeEach(() => {
  for (const key of Object.keys(BASE_ENV)) delete process.env[key];
  delete process.env.MONETICO_SOCIETE_IMMEDIATE;
  delete process.env.CHECKOUT_PLANS;
});

describe("missingCheckoutEnv", () => {
  it("exige le code site immédiat dès que l'annuel est vendable", async () => {
    const { missingCheckoutEnv, hasCheckout } = await loadEnv({
      CHECKOUT_PLANS: "all",
    });
    expect(missingCheckoutEnv()).toContain("MONETICO_SOCIETE_IMMEDIATE");
    expect(hasCheckout()).toBe(false);
  });

  it("se satisfait d'une déclaration explicite, même identique", async () => {
    const { missingCheckoutEnv, hasCheckout } = await loadEnv({
      CHECKOUT_PLANS: "all",
      MONETICO_SOCIETE_IMMEDIATE: "medicarepr",
    });
    expect(missingCheckoutEnv()).toEqual([]);
    expect(hasCheckout()).toBe(true);
  });

  it("n'exige rien de plus quand seul le mensuel est vendu", async () => {
    const { missingCheckoutEnv } = await loadEnv({ CHECKOUT_PLANS: "monthly" });
    expect(missingCheckoutEnv()).toEqual([]);
  });

  it("laisse le socle billing (donc l'IPN) intact malgré la caisse fermée", async () => {
    const { missingBillingEnv, hasBilling } = await loadEnv({
      CHECKOUT_PLANS: "all",
    });
    // Une notification de paiement doit toujours pouvoir être acquittée.
    expect(missingBillingEnv()).toEqual([]);
    expect(hasBilling()).toBe(true);
  });
});

describe("billingConfigWarnings", () => {
  it("signale deux formules vendues sur un seul code site", async () => {
    const { billingConfigWarnings } = await loadEnv({
      CHECKOUT_PLANS: "all",
      MONETICO_SOCIETE_IMMEDIATE: "medicarepr",
    });
    expect(billingConfigWarnings()).toHaveLength(1);
    expect(billingConfigWarnings()[0]).toContain("même code site");
  });

  it("se tait quand chaque formule a son code site", async () => {
    const { billingConfigWarnings } = await loadEnv({
      CHECKOUT_PLANS: "all",
      MONETICO_SOCIETE_IMMEDIATE: "medicarepa",
    });
    expect(billingConfigWarnings()).toEqual([]);
  });

  it("se tait quand une seule formule est vendue", async () => {
    const { billingConfigWarnings } = await loadEnv({
      CHECKOUT_PLANS: "monthly",
      MONETICO_SOCIETE_IMMEDIATE: "medicarepr",
    });
    expect(billingConfigWarnings()).toEqual([]);
  });
});
