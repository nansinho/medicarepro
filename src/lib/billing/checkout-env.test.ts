import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
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

  /* Vu en production le 05/08/2026 : le tunnel affichait le bandeau rouge
     « à des fins de test uniquement » juste au-dessus du bouton de paiement,
     et laissait passer n'importe quel robot. Personne ne pouvait le savoir
     depuis le back-office. */
  it("signale les clés de démonstration Cloudflare", async () => {
    const { billingConfigWarnings, usesTurnstileDemoKeys } = await loadEnv({
      CHECKOUT_PLANS: "monthly",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000",
    });
    expect(usesTurnstileDemoKeys()).toBe(true);
    expect(billingConfigWarnings()).toHaveLength(1);
    expect(billingConfigWarnings()[0]).toContain("Turnstile");
  });

  it("se tait sur de vraies clés Turnstile", async () => {
    const { usesTurnstileDemoKeys } = await loadEnv({
      CHECKOUT_PLANS: "monthly",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAABkMYinukE8nzYS",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAABkMYinukE8nzYSaBcDeFgHiJk",
    });
    expect(usesTurnstileDemoKeys()).toBe(false);
  });
});

/* ============================================================
   Mode test sur le site en ligne.

   CE QUE CES TESTS EMPÊCHENT DE SE REPRODUIRE : le 05/08/2026, la production
   encaissait avec MONETICO_MODE=test. Les cartes partaient sur la plateforme
   d'essai de Monetico, où aucune carte réelle n'aboutit. Un praticien a essuyé
   quatre refus « Interdit » sur une offre à 478,08 € puis a renoncé — et rien,
   ni dans le back office ni dans le tunnel, ne signalait la cause.

   La détection doit rester CHIRURGICALE : trop large, elle crierait au loup
   pendant tout le développement, et on la couperait. Elle ne s'allume donc que
   sur la conjonction exacte qui fait perdre des clients — mode test + build de
   production + domaine public.
   ============================================================ */

describe("paymentsInTestModeOnLiveSite", () => {
  const nodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    vi.unstubAllEnvs();
    if (nodeEnv !== undefined) vi.stubEnv("NODE_ENV", nodeEnv);
  });

  it("s'allume en mode test sur un domaine public en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { paymentsInTestModeOnLiveSite } = await loadEnv({
      MONETICO_MODE: "test",
      NEXT_PUBLIC_SITE_URL: "https://medicarepro.fr",
    });
    expect(paymentsInTestModeOnLiveSite()).toBe(true);
  });

  it("se tait en mode production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { paymentsInTestModeOnLiveSite } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: "1".repeat(40),
      NEXT_PUBLIC_SITE_URL: "https://medicarepro.fr",
    });
    expect(paymentsInTestModeOnLiveSite()).toBe(false);
  });

  it("se tait en développement, où le mode test est la norme", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { paymentsInTestModeOnLiveSite } = await loadEnv({
      MONETICO_MODE: "test",
      NEXT_PUBLIC_SITE_URL: "https://medicarepro.fr",
    });
    expect(paymentsInTestModeOnLiveSite()).toBe(false);
  });

  it("se tait sur un serveur local, même compilé en production", async () => {
    // `next start` en local vaut NODE_ENV=production : sans le second signal,
    // le bandeau s'afficherait à chaque vérification faite sur son poste.
    vi.stubEnv("NODE_ENV", "production");
    const { paymentsInTestModeOnLiveSite } = await loadEnv({
      MONETICO_MODE: "test",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
    expect(paymentsInTestModeOnLiveSite()).toBe(false);
  });
});
