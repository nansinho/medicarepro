import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
   Construction d'une session de paiement.

   Tout ce qui peut mal tourner ici coûte de l'argent à quelqu'un : le mauvais
   prix, la mauvaise quantité, ou une adresse de retour qui renvoie un client
   refusé sur un écran de remerciement. Les trois se sont produits en 2026.
   ============================================================ */

const PRIX = {
  STRIPE_PRICE_MONTHLY_TEST: "price_mensuel",
  STRIPE_PRICE_ANNUAL_TEST: "price_annuel",
  STRIPE_PRICE_COLLABORATOR_MONTHLY_TEST: "price_collab_mensuel",
  STRIPE_PRICE_COLLABORATOR_ANNUAL_TEST: "price_collab_annuel",
};

async function charger(overrides: Record<string, string> = {}) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SITE_URL = "https://medicarepro.fr";
  process.env.STRIPE_SECRET_KEY_TEST = "sk_test_51AbCdEfGhIjKlMnOp";
  for (const [k, v] of Object.entries({ ...PRIX, ...overrides })) {
    if (v === "") delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/stripe/checkout");
}

const BASE = {
  reference: "MPABCDEFGH12",
  plan: "MONTHLY" as const,
  extraCollaborators: 0,
  customerEmail: "cabinet@example.fr",
  successPath: "/mon-abonnement/merci",
  errorPath: "/mon-abonnement/echec",
};

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("STRIPE_")) delete process.env[k];
  }
});

describe("buildCheckoutParams", () => {
  it("envoie le prix du catalogue, jamais un montant", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_mensuel", quantity: 1 }]);
    /* Aucun montant ne doit figurer : c'est Stripe qui tarife. Le formulaire
       Monetico, lui, portait le montant et ne le protégeait que par un sceau. */
    expect(JSON.stringify(p)).not.toContain("2988");
    expect(JSON.stringify(p)).not.toContain("unit_amount");
  });

  it("choisit le prix annuel pour l'offre 12 mois", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams({ ...BASE, plan: "ANNUAL" });
    expect(p.line_items?.[0]).toEqual({ price: "price_annuel", quantity: 1 });
  });

  it("ajoute les collaborateurs en quantité, dans la bonne périodicité", async () => {
    const { buildCheckoutParams } = await charger();
    const mensuel = buildCheckoutParams({ ...BASE, extraCollaborators: 3 });
    expect(mensuel.line_items).toEqual([
      { price: "price_mensuel", quantity: 1 },
      { price: "price_collab_mensuel", quantity: 3 },
    ]);
    const annuel = buildCheckoutParams({
      ...BASE,
      plan: "ANNUAL",
      extraCollaborators: 2,
    });
    expect(annuel.line_items?.[1]).toEqual({
      price: "price_collab_annuel",
      quantity: 2,
    });
  });

  it("n'ajoute pas de ligne collaborateur pour un titulaire seul", async () => {
    const { buildCheckoutParams } = await charger();
    expect(buildCheckoutParams(BASE).line_items).toHaveLength(1);
  });

  /* Sous-facturer est pire que refuser : le cabinet paierait moins que ce qu'il
     a lu à l'écran, et personne ne s'en apercevrait avant la comptabilité. */
  it("refuse plutôt que de sous-facturer un cabinet avec collaborateurs", async () => {
    const { buildCheckoutParams } = await charger({
      STRIPE_PRICE_COLLABORATOR_MONTHLY_TEST: "",
    });
    expect(() =>
      buildCheckoutParams({ ...BASE, extraCollaborators: 2 }),
    ).toThrow(/collaborateur/i);
    // Sans collaborateur, ce prix ne sert pas : la souscription doit passer.
    expect(() => buildCheckoutParams(BASE)).not.toThrow();
  });

  it("refuse une formule sans prix configuré", async () => {
    const { buildCheckoutParams } = await charger({ STRIPE_PRICE_ANNUAL_TEST: "" });
    expect(() => buildCheckoutParams({ ...BASE, plan: "ANNUAL" })).toThrow(/ANNUAL/);
  });

  /* La faute exacte relevée par Monetico sur le contrat : la même adresse pour
     l'accepté et le refusé, donc une carte refusée qui atterrit sur « merci ». */
  it("refuse deux chemins de retour identiques", async () => {
    const { buildCheckoutParams } = await charger();
    expect(() =>
      buildCheckoutParams({ ...BASE, errorPath: BASE.successPath }),
    ).toThrow(/différer/);
  });

  it("refuse un nombre de collaborateurs aberrant", async () => {
    const { buildCheckoutParams } = await charger();
    expect(() => buildCheckoutParams({ ...BASE, extraCollaborators: -1 })).toThrow();
    expect(() => buildCheckoutParams({ ...BASE, extraCollaborators: 1.5 })).toThrow();
    expect(() => buildCheckoutParams({ ...BASE, extraCollaborators: 99 })).toThrow(
      /maximum/,
    );
  });

  /* Le piège 0.0.0.0 : en production le serveur standalone dérive son URL de
     HOSTNAME et PORT. Un client payé serait renvoyé sur une adresse
     injoignable — c'est arrivé le 04/08/2026 avec un jeton à usage unique. */
  it("construit des adresses de retour publiques et distinctes", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    expect(p.success_url).toBe(
      "https://medicarepro.fr/mon-abonnement/merci?ref=MPABCDEFGH12",
    );
    expect(p.cancel_url).toBe(
      "https://medicarepro.fr/mon-abonnement/echec?ref=MPABCDEFGH12",
    );
    expect(p.success_url).not.toBe(p.cancel_url);
    expect(JSON.stringify(p)).not.toContain("0.0.0.0");
  });

  /* Sans référence sur l'ABONNEMENT, les invoice.paid des mois suivants
     arriveraient sans qu'on sache à quel contrat les rattacher :
     client_reference_id ne vit que sur la session. */
  it("pose notre référence sur la session ET sur l'abonnement", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams({ ...BASE, metadata: { origine: "portail" } });
    expect(p.client_reference_id).toBe("MPABCDEFGH12");
    expect(p.metadata).toEqual({ origine: "portail", reference: "MPABCDEFGH12" });
    expect(p.subscription_data?.metadata).toEqual({
      origine: "portail",
      reference: "MPABCDEFGH12",
    });
  });

  it("propose la carte et le prélèvement SEPA, en français", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    expect(p.payment_method_types).toEqual(["card", "sepa_debit"]);
    expect(p.locale).toBe("fr");
    expect(p.customer_email).toBe("cabinet@example.fr");
  });
});
