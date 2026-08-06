import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
   Construction d'une session de paiement.

   Tout ce qui peut mal tourner ici coûte de l'argent à quelqu'un : le mauvais
   prix, la mauvaise quantité, ou une adresse de retour qui renvoie un client
   refusé sur un écran de remerciement. Les trois se sont produits en 2026.
   ============================================================ */

const PRIX = {
  STRIPE_TAX_RATE_TEST: "txr_tva20",
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
  customerId: "cus_test_cabinet",
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
    /* Au-delà du garde-fou de saisie : sans lui, un nombre absurde posté à la
       main ouvrirait un abonnement de plusieurs centaines de milliers d'euros
       chez Stripe. Il ne s'agit plus d'une limite d'offre — un cabinet peut
       déclarer autant de collaborateurs qu'il en emploie. */
    expect(() =>
      buildCheckoutParams({ ...BASE, extraCollaborators: 99999 }),
    ).toThrow(/maximum/);
    expect(() =>
      buildCheckoutParams({ ...BASE, extraCollaborators: 25 }),
    ).not.toThrow();
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


  /* La toute première facture réelle, le 05/08/2026, portait « HARUA — France »
     et rien d'autre : ni rue, ni code postal. Une session ouverte avec la seule
     adresse électronique ne transmet que celle-ci, et Stripe imprime ce qu'il a.
     L'adresse du destinataire est pourtant une mention obligatoire. */
  it("rattache le client Stripe plutôt que sa seule adresse électronique", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    expect(p.customer).toBe("cus_test_cabinet");
    expect(p.customer_email).toBeUndefined();
    expect(p.customer_update).toEqual({ address: "auto", name: "auto" });
  });

  it("accepte l'adresse électronique en repli, jamais les deux ensemble", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams({
      ...BASE,
      customerId: undefined,
      customerEmail: "cabinet@example.fr",
    });
    expect(p.customer_email).toBe("cabinet@example.fr");
    expect(p.customer).toBeUndefined();
    // Stripe refuse les deux ensemble : notre construction ne peut pas les poser.
    expect("customer" in p && "customer_email" in p).toBe(false);
  });

  it("refuse une session sans aucun moyen d'identifier le client", async () => {
    const { buildCheckoutParams } = await charger();
    expect(() =>
      buildCheckoutParams({ ...BASE, customerId: undefined, customerEmail: undefined }),
    ).toThrow(/client/i);
  });


  /* La première facture réelle est sortie sans ligne de TVA : sous-total et
     total valaient tous deux 29,88 €. Stripe n'a aucun réglage de compte pour
     un taux par défaut, il doit être passé à chaque abonnement. Une facture
     française sans mention de TVA ne vaut rien pour la comptabilité du
     cabinet. */
  it("applique le taux de TVA à l'abonnement", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    expect(p.subscription_data?.default_tax_rates).toEqual(["txr_tva20"]);
  });

  it("refuse de vendre sans taux de TVA configuré", async () => {
    const { buildCheckoutParams } = await charger({ STRIPE_TAX_RATE_TEST: "" });
    expect(() => buildCheckoutParams(BASE)).toThrow(/TVA/);
  });

  it("propose la carte et le prélèvement SEPA, en français", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(BASE);
    /* AUCUNE liste imposée : Stripe propose ce qui est activé sur le compte.
       Une liste en dur faisait refuser la session entière dès qu'un moyen
       n'était pas activé — le client n'atteignait jamais la page de paiement. */
    expect(p.payment_method_types).toBeUndefined();
    expect(p.locale).toBe("fr");
    expect(p.customer).toBe("cus_test_cabinet");
  });
});

/* ============================================================
   RÈGLEMENT EN TROIS FOIS.

   Ce n'est PAS une session d'abonnement, et c'est le cœur du sujet. Deux
   montages ont été mesurés chez Stripe le 06/08/2026 avant de retenir celui-ci :

     - abonnement + ancrage du cycle à 12 mois  -> 397,41 € prélevés (l'année
       entière EN PLUS du versement), car une ligne ponctuelle interdit
       `proration_behavior: none` dans Checkout ;
     - abonnement + période d'essai de 12 mois  -> le bon montant, mais Stripe
       imprime une ligne « Essai gratuit » à 0 € sur une facture pourtant
       payée, et une facture finalisée n'est plus modifiable.

   D'où une session en MODE PAIEMENT : la facture ne porte que notre ligne.
   L'abonnement est ouvert ensuite par nous, hors Checkout.
   ============================================================ */
describe("buildCheckoutParams — règlement en trois fois", () => {
  const ANNUEL = { ...BASE, plan: "ANNUAL" as const };
  const TROIS = { ...ANNUEL, instalments: [9936, 9936, 9936] };

  it("encaisse le premier versement, et rien de plus", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(TROIS);
    expect(p.mode).toBe("payment");
    expect(p.line_items).toHaveLength(1);
    expect(p.line_items?.[0]?.price_data?.unit_amount).toBe(9936);
    /* TTC comme nos prix de catalogue : sans ça la TVA s'ajouterait par-dessus
       et le praticien paierait 119,23 € au lieu de 99,36 €. */
    expect(p.line_items?.[0]?.price_data?.tax_behavior).toBe("inclusive");
  });

  /* AUCUN ABONNEMENT ICI. S'il en naissait un, Stripe facturerait les douze
     mois par-dessus le versement, ou imprimerait « Essai gratuit ». */
  it("n'ouvre aucun abonnement depuis Checkout", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(TROIS);
    expect(p.subscription_data).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain("trial_end");
    expect(JSON.stringify(p)).not.toContain("billing_cycle_anchor");
  });

  /* En mode paiement il n'y a pas de `subscription_data` pour porter le taux :
     sans lui la facture sort sans ligne de TVA, et une facture française sans
     TVA ne vaut rien pour la comptabilité du cabinet. */
  it("porte la TVA sur la ligne elle-même", async () => {
    const { buildCheckoutParams } = await charger();
    expect(buildCheckoutParams(TROIS).line_items?.[0]?.tax_rates).toEqual([
      "txr_tva20",
    ]);
  });

  it("refuse de vendre en versements sans taux de TVA configuré", async () => {
    const { buildCheckoutParams } = await charger({ STRIPE_TAX_RATE_TEST: "" });
    expect(() => buildCheckoutParams(TROIS)).toThrow(/TVA/);
  });

  /* Une vraie facture, pas un reçu de paiement : le praticien la remet à son
     comptable. Et la carte doit survivre à la session, sinon il n'y aurait rien
     à prélever le mois prochain. */
  it("émet une facture et conserve la carte pour les versements suivants", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(TROIS);
    expect(p.invoice_creation?.enabled).toBe(true);
    expect(p.payment_intent_data?.setup_future_usage).toBe("off_session");
  });

  /* Ces trois valeurs sont le SEUL lien entre la session et l'abonnement qu'on
     ouvrira après : en mode paiement, rien d'autre ne les porte. */
  it("transmet de quoi ouvrir l'abonnement après le paiement", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams({ ...TROIS, extraCollaborators: 2 });
    expect(p.metadata?.instalments).toBe("3");
    expect(p.metadata?.plan).toBe("ANNUAL");
    expect(p.metadata?.collaborators).toBe("2");
    expect(p.client_reference_id).toBe("MPABCDEFGH12");
  });

  it("ne change rien au paiement comptant", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(ANNUEL);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_annuel", quantity: 1 }]);
    expect(p.invoice_creation).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain("versement");
  });

  /* Le mensuel est déjà un étalement : le redécouper produirait des versements
     de dix euros pour un coût de traitement identique. */
  it("refuse l'échelonnement sur la formule mensuelle", async () => {
    const { buildCheckoutParams } = await charger();
    expect(() =>
      buildCheckoutParams({ ...BASE, instalments: [996, 996, 996] }),
    ).toThrow(/12 mois/);
  });

  it("refuse un échelonnement dégénéré ou des montants aberrants", async () => {
    const { buildCheckoutParams } = await charger();
    expect(() => buildCheckoutParams({ ...ANNUEL, instalments: [29808] })).toThrow(
      /deux versements/,
    );
    expect(() =>
      buildCheckoutParams({ ...ANNUEL, instalments: [9936, 0, 9936] }),
    ).toThrow(/invalide/);
    expect(() =>
      buildCheckoutParams({ ...ANNUEL, instalments: [9936, -1, 9936] }),
    ).toThrow(/invalide/);
  });

  /* Ce qu'il lit juste avant de payer. Le laisser découvrir le second
     prélèvement un mois plus tard est ce qui produit une contestation bancaire,
     laquelle coûte plus cher que le versement lui-même. */
  it("annonce le calendrier ET la conséquence d'un refus", async () => {
    const { buildCheckoutParams } = await charger();
    const submit = buildCheckoutParams(TROIS).custom_text?.submit;
    const message = (typeof submit === "object" && submit?.message) || "";
    expect(message).toMatch(/1er de 3 versements/);
    expect(message).toMatch(/lecture seule/);
  });

  /* LE MONTAGE EXIGE UN MOYEN REDÉBITABLE HORS PRÉSENCE DU CLIENT : les
     versements 2 et 3, puis la reconduction, sont prélevés par nous des
     semaines plus tard. Klarna et Satispay ne se laissent pas redébiter ainsi —
     ils étaient proposés en essai le 06/08/2026 — et notre règle passe le
     cabinet en lecture seule dès le premier refus. On suspendrait un praticien
     pour une faute qui serait la nôtre. */
  it("n'accepte que la carte, seule redébitable sans le client", async () => {
    const { buildCheckoutParams } = await charger();
    expect(buildCheckoutParams(TROIS).payment_method_types).toEqual(["card"]);
  });

  /* Le comptant, lui, ne prélève jamais rien hors présence : Stripe doit y
     garder la main, sinon une liste en dur fait refuser toute session dès qu'un
     moyen est désactivé — ce qui s'est produit en production. */
  it("laisse le comptant libre de tout moyen imposé", async () => {
    const { buildCheckoutParams } = await charger();
    expect(buildCheckoutParams(ANNUEL).payment_method_types).toBeUndefined();
    expect(buildCheckoutParams(BASE).payment_method_types).toBeUndefined();
  });

  it("garde deux adresses de retour distinctes, comme en comptant", async () => {
    const { buildCheckoutParams } = await charger();
    const p = buildCheckoutParams(TROIS);
    expect(p.success_url).toContain("/mon-abonnement/merci");
    expect(p.cancel_url).toContain("/mon-abonnement/echec");
    expect(p.success_url).not.toBe(p.cancel_url);
  });
});
