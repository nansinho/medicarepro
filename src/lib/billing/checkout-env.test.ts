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
    // Chaîne vide = variable ABSENTE, pour pouvoir tester ce qui manque.
    if (v === "") delete process.env[k];
    else process.env[k] = v;
  }
  return {
    ...(await import("@/lib/env")),
    ...(await import("@/lib/billing/monetico-routing")),
  };
}

beforeEach(() => {
  for (const key of Object.keys(BASE_ENV)) delete process.env[key];
  delete process.env.MONETICO_SOCIETE_IMMEDIATE;
  delete process.env.CHECKOUT_PLANS;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.MONETICO_KEY_PROD;
  delete process.env.MONETICO_TPE_IMMEDIATE;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("STRIPE_") || k.includes("STRIPE_PUBLISHABLE")) {
      delete process.env[k];
    }
  }
  delete process.env.PAYMENT_PROVIDER;
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

/* ============================================================
   Vérification des sceaux entrants : les DEUX plateformes.

   Ce que le silence a failli coûter, le 05/08/2026 : une notification dont le
   sceau n'était pas reconnu repartait avec cdr=1, sans log ni alerte. Le site
   ayant tourné en mode test alors qu'il était en ligne, un client réellement
   débité aurait disparu sans laisser de trace. Le numéro de TPE ne distingue
   pas les deux plateformes : seul le sceau le fait, donc il faut pouvoir
   l'essayer avec les deux clés.
   ============================================================ */
describe("moneticoIpnKeyCandidates", () => {
  const CLE_PROD = "A".repeat(40);
  const CLE_TEST = "B".repeat(40);

  it("essaie la plateforme courante d'abord, puis l'autre", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
    });
    expect(moneticoIpnKeyCandidates("NB8179R")).toEqual([
      { key: CLE_PROD, platform: "production" },
      { key: CLE_TEST, platform: "test" },
    ]);
  });

  it("inverse l'ordre en mode test", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "test",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
    });
    expect(
      moneticoIpnKeyCandidates("NB8179R").map((c) => c.platform),
    ).toEqual(["test", "production"]);
  });

  /* Le TPE immédiat n'a pas de clé propre aujourd'hui : Monetico n'en délivre
     qu'une par société. Le repli doit rester silencieux et correct. */
  it("replie le TPE immédiat sur la clé du récurrent", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
      MONETICO_TPE_IMMEDIATE: "NB8179I",
    });
    expect(moneticoIpnKeyCandidates("NB8179I")).toEqual([
      { key: CLE_PROD, platform: "production" },
      { key: CLE_TEST, platform: "test" },
    ]);
  });

  /* MONETICO_KEY_TEST peut très bien être absent de la production. On ne doit
     ni jeter, ni fabriquer une candidate vide qui validerait n'importe quoi. */
  it("ignore une plateforme dont la clé n'est pas configurée", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: "",
    });
    expect(moneticoIpnKeyCandidates("NB8179R")).toEqual([
      { key: CLE_PROD, platform: "production" },
    ]);
  });

  it("ne propose pas deux fois la même clé", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_PROD,
    });
    expect(moneticoIpnKeyCandidates("NB8179R")).toHaveLength(1);
  });
});

/* ============================================================
   Une notification scellée par l'AUTRE plateforme doit être RECONNUE.

   C'est le cœur de l'incident du 05/08/2026. Les 7 abonnements existants ont
   été payés sur la plateforme d'essai, le site est passé en production, et
   chaque notification de l'essai tombait alors sur un sceau invalide — donc
   sur un `cdr=1` muet, sans log ni alerte. Dans l'autre sens, c'est un client
   réellement débité qui disparaît.

   Ce test vérifie ce que le balayage de source ne peut pas voir : que la
   vérification essaie bien les deux clés, et sache DIRE laquelle a répondu.
   ============================================================ */
describe("reconnaissance d'un sceau de l'autre plateforme", () => {
  const CLE_PROD = "A".repeat(40);
  const CLE_TEST = "B".repeat(40);

  /** Notification telle que Monetico l'émet, scellée avec la clé fournie. */
  async function notification(cle: string) {
    const { sealFields } = await import("@/lib/monetico");
    const champs: Record<string, string> = {
      TPE: "NB8179R",
      date: "01/08/2026_a_13:05:23",
      montant: "179.88EUR",
      reference: "MPNJZE2FMEY8",
      "code-retour": "payetest",
      "texte-libre": "",
    };
    champs.MAC = sealFields(champs, cle);
    return champs;
  }

  it("identifie la plateforme d'essai alors que le site est en production", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
    });
    const { verifyIpnSeal } = await import("@/lib/monetico");
    const champs = await notification(CLE_TEST);

    const reconnue = moneticoIpnKeyCandidates(champs.TPE).find((c) =>
      verifyIpnSeal(champs, c.key),
    );
    expect(reconnue?.platform).toBe("test");
  });

  it("identifie la production quand c'est elle qui a scellé", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
    });
    const { verifyIpnSeal } = await import("@/lib/monetico");
    const champs = await notification(CLE_PROD);

    const reconnue = moneticoIpnKeyCandidates(champs.TPE).find((c) =>
      verifyIpnSeal(champs, c.key),
    );
    expect(reconnue?.platform).toBe("production");
  });

  /* Le cas qui doit alerter : un sceau qu'aucune clé ne valide. Ni l'un ni
     l'autre, donc on ne devine pas — on prévient. */
  it("ne reconnaît rien quand aucune clé ne valide", async () => {
    const { moneticoIpnKeyCandidates } = await loadEnv({
      MONETICO_MODE: "production",
      MONETICO_KEY_PROD: CLE_PROD,
      MONETICO_KEY_TEST: CLE_TEST,
    });
    const { verifyIpnSeal } = await import("@/lib/monetico");
    const champs = await notification("C".repeat(40));

    const reconnue = moneticoIpnKeyCandidates(champs.TPE).find((c) =>
      verifyIpnSeal(champs, c.key),
    );
    expect(reconnue).toBeUndefined();
  });
});

/* ============================================================
   Configuration Stripe : refuser d'encaisser à moitié.

   Le 05/08/2026, la vente a été bloquée toute la journée par des
   configurations qui se croyaient complètes. Deux leçons sont fixées ici :
   un secret de webhook manquant n'est pas un détail, et un prix de
   collaborateur manquant ne se voit qu'au moment où un cabinet en déclare un,
   c'est-à-dire trop tard.
   ============================================================ */
describe("configuration Stripe", () => {
  const SK = "sk_test_51AbCdEfGhIjKlMnOp";
  const SK_LIVE = "sk_live_51AbCdEfGhIjKlMnOp";
  const WH = "whsec_AbCdEfGhIjKlMnOpQrSt";

  it("exige la clé, le secret de webhook et au moins un prix", async () => {
    const { missingStripeEnv, hasStripeCheckout } = await loadEnv({});
    expect(missingStripeEnv()).toEqual([
      "STRIPE_SECRET_KEY_TEST",
      "STRIPE_WEBHOOK_SECRET_TEST",
      "STRIPE_PRICE_MONTHLY_TEST ou STRIPE_PRICE_ANNUAL_TEST",
    ]);
    expect(hasStripeCheckout()).toBe(false);
  });

  /* Sans secret de webhook, un `invoice.paid` fabriqué prolongerait une période
     sans qu'un centime soit entré. Ce n'est pas une variable de confort. */
  it("refuse d'encaisser sans secret de webhook", async () => {
    const { missingStripeEnv } = await loadEnv({
      STRIPE_SECRET_KEY: SK,
      STRIPE_PRICE_MONTHLY: "price_m",
      STRIPE_PRICE_COLLABORATOR_MONTHLY: "price_cm",
    });
    expect(missingStripeEnv()).toEqual(["STRIPE_WEBHOOK_SECRET_TEST"]);
  });

  it("exige le prix collaborateur de chaque formule vendue", async () => {
    const { missingStripeEnv } = await loadEnv({
      STRIPE_SECRET_KEY: SK,
      STRIPE_WEBHOOK_SECRET: WH,
      STRIPE_PRICE_MONTHLY: "price_m",
    });
    expect(missingStripeEnv()).toEqual(["STRIPE_PRICE_COLLABORATOR_MONTHLY_TEST"]);
  });

  it("se tait quand tout est là", async () => {
    const { missingStripeEnv, hasStripeCheckout } = await loadEnv({
      STRIPE_SECRET_KEY: SK,
      STRIPE_WEBHOOK_SECRET: WH,
      STRIPE_PRICE_MONTHLY: "price_m",
      STRIPE_PRICE_COLLABORATOR_MONTHLY: "price_cm",
    });
    expect(missingStripeEnv()).toEqual([]);
    expect(hasStripeCheckout()).toBe(true);
  });

  /* Le piège qu'on veut rendre impossible : annoncer Stripe sans avoir posé
     les clés, et laisser le tunnel proposer un paiement qui échouera après que
     le client a saisi tout son dossier. */
  it("canCollectPayment suit le prestataire déclaré", async () => {
    const sansCles = await loadEnv({ PAYMENT_PROVIDER: "stripe" });
    expect(sansCles.paymentProvider()).toBe("stripe");
    expect(sansCles.canCollectPayment()).toBe(false);

    const avecCles = await loadEnv({
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: SK,
      STRIPE_WEBHOOK_SECRET: WH,
      STRIPE_PRICE_ANNUAL: "price_a",
      STRIPE_PRICE_COLLABORATOR_ANNUAL: "price_ca",
    });
    expect(avecCles.canCollectPayment()).toBe(true);
  });


  /* ------------------------------------------------------------
     Les deux mondes cohabitent, mais ne se confondent pas.

     Le client voulait renseigner ses clés une seule fois, test et production
     ensemble, et basculer sans ressaisir. C'est légitime — c'est exactement ce
     que faisait MONETICO_MODE. Ce qui a coûté une journée le 05/08/2026, ce
     n'était pas d'avoir deux jeux de clés : c'était qu'un sélecteur puisse
     annoncer un monde sans que rien ne le confronte à la réalité.

     Chez Stripe la clé porte son propre monde dans son préfixe. La déclaration
     devient donc vérifiable, et ces tests fixent qu'elle EST vérifiée.
     ------------------------------------------------------------ */

  it("choisit le jeu de clés désigné par STRIPE_MODE", async () => {
    const { stripeConfig } = await loadEnv({
      STRIPE_MODE: "live",
      STRIPE_SECRET_KEY_TEST: SK,
      STRIPE_SECRET_KEY_LIVE: SK_LIVE,
      STRIPE_PRICE_MONTHLY_TEST: "price_test",
      STRIPE_PRICE_MONTHLY_LIVE: "price_live",
    });
    const c = stripeConfig();
    expect(c.mode).toBe("live");
    expect(c.secretKey).toBe(SK_LIVE);
    expect(c.prices.monthly).toBe("price_live");
  });

  it("accepte la forme sans suffixe quand un seul monde est servi", async () => {
    const { stripeConfig } = await loadEnv({
      STRIPE_SECRET_KEY: SK,
      STRIPE_PRICE_ANNUAL: "price_a",
    });
    const c = stripeConfig();
    expect(c.secretKey).toBe(SK);
    expect(c.prices.annual).toBe("price_a");
  });

  /* Deux barrières, et il faut les deux.

     La PREMIÈRE est le schéma : STRIPE_SECRET_KEY_LIVE n'accepte qu'un
     `sk_live_`, donc y ranger une clé d'essai est refusé au chargement. */
  it("refuse une clé d'essai rangée du côté production", async () => {
    await expect(
      loadEnv({ STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: SK }).then((m) =>
        m.stripeConfig(),
      ),
    ).rejects.toThrow();
  });

  /* La SECONDE est la garde de concordance, et c'est elle qui compte, parce que
     la forme sans suffixe accepte les deux préfixes par construction. Annoncer
     la production en servant une clé d'essai, c'est le scénario exact du
     05/08/2026 : le site se croyait en production pendant que les commandes
     vivaient en essai, et plus rien n'aboutissait sans que quoi que ce soit le
     signale. Ici, on refuse d'encaisser plutôt que de croire la déclaration. */
  it("refuse d'encaisser quand le mode annoncé contredit la clé servie", async () => {
    const { missingStripeEnv, canCollectPayment } = await loadEnv({
      PAYMENT_PROVIDER: "stripe",
      STRIPE_MODE: "live",
      STRIPE_SECRET_KEY: SK, // forme sans suffixe : une clé d'ESSAI
      STRIPE_WEBHOOK_SECRET: WH,
      STRIPE_PRICE_ANNUAL: "price_a",
      STRIPE_PRICE_COLLABORATOR_ANNUAL: "price_ca",
    });
    expect(missingStripeEnv().join(" ")).toContain("ne correspond pas à la clé");
    expect(canCollectPayment()).toBe(false);
  });

  it("se tait quand le mode et la clé concordent", async () => {
    const { missingStripeEnv, canCollectPayment } = await loadEnv({
      PAYMENT_PROVIDER: "stripe",
      STRIPE_MODE: "live",
      STRIPE_SECRET_KEY_LIVE: SK_LIVE,
      STRIPE_WEBHOOK_SECRET_LIVE: WH,
      STRIPE_PRICE_ANNUAL_LIVE: "price_a",
      STRIPE_PRICE_COLLABORATOR_ANNUAL_LIVE: "price_ca",
    });
    expect(missingStripeEnv()).toEqual([]);
    expect(canCollectPayment()).toBe(true);
  });

  /* Renseigner les deux mondes ne doit jamais faire encaisser dans le mauvais :
     le jeu inutilisé est ignoré, pas mélangé. */
  it("ignore le monde non sélectionné, même entièrement renseigné", async () => {
    const { stripeConfig, missingStripeEnv } = await loadEnv({
      STRIPE_MODE: "test",
      STRIPE_SECRET_KEY_TEST: SK,
      STRIPE_WEBHOOK_SECRET_TEST: WH,
      STRIPE_PRICE_MONTHLY_TEST: "price_mt",
      STRIPE_PRICE_COLLABORATOR_MONTHLY_TEST: "price_cmt",
      STRIPE_SECRET_KEY_LIVE: SK_LIVE,
      STRIPE_WEBHOOK_SECRET_LIVE: "whsec_ProductionAbCdEfGhIj",
      STRIPE_PRICE_MONTHLY_LIVE: "price_ml",
      STRIPE_PRICE_COLLABORATOR_MONTHLY_LIVE: "price_cml",
    });
    expect(stripeConfig().secretKey).toBe(SK);
    expect(stripeConfig().prices.monthly).toBe("price_mt");
    expect(missingStripeEnv()).toEqual([]);
  });

  /* La clé publique n'est PAS exigée : avec la redirection vers Stripe
     Checkout, la session est créée côté serveur et le navigateur ne parle
     jamais à Stripe. L'exiger bloquerait l'encaissement sans raison. */
  it("n'exige pas la clé publique", async () => {
    const { missingStripeEnv } = await loadEnv({
      STRIPE_SECRET_KEY_TEST: SK,
      STRIPE_WEBHOOK_SECRET_TEST: WH,
      STRIPE_PRICE_ANNUAL_TEST: "price_a",
      STRIPE_PRICE_COLLABORATOR_ANNUAL_TEST: "price_ca",
    });
    expect(missingStripeEnv()).toEqual([]);
  });

  /* Mais si elle est fournie, elle doit désigner le même monde. Elle ne casse
     rien aujourd'hui puisqu'elle n'est pas utilisée — elle mentirait le jour où
     elle le sera, et ce jour-là personne ne repensera à ce fichier. */
  it("refuse une clé publique qui contredit le mode", async () => {
    const { missingStripeEnv } = await loadEnv({
      STRIPE_MODE: "test",
      STRIPE_SECRET_KEY_TEST: SK,
      STRIPE_WEBHOOK_SECRET_TEST: WH,
      STRIPE_PRICE_ANNUAL_TEST: "price_a",
      STRIPE_PRICE_COLLABORATOR_ANNUAL_TEST: "price_ca",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_AbCdEfGhIjKlMnOp",
    });
    expect(missingStripeEnv().join(" ")).toContain("clé publique");
  });

  /* ------------------------------------------------------------
     Une coquille ne doit pas mettre le site à terre.

     Constaté en production le 05/08/2026 : PAYMENT_PROVIDER saisie avec une
     casse ou un espace en trop faisait échouer la validation de TOUT
     l'environnement, donc planter chaque route en 500. Le site entier tombait
     pour une variable de confort.
     ------------------------------------------------------------ */
  it("tolère la casse, les espaces et les guillemets d'un copier-coller", async () => {
    for (const saisie of [" stripe", "Stripe", "STRIPE ", '"stripe"', "'stripe'"]) {
      const { paymentProvider } = await loadEnv({ PAYMENT_PROVIDER: saisie });
      expect(paymentProvider(), `saisie « ${saisie} »`).toBe("stripe");
    }
  });

  it("retombe sur Monetico sans jeter quand la valeur est inconnue", async () => {
    const { paymentProvider, env } = await loadEnv({ PAYMENT_PROVIDER: "stripes" });
    expect(() => env()).not.toThrow();
    // Le côté sûr de l'erreur : la vente s'arrête, le site reste debout.
    expect(paymentProvider()).toBe("monetico");
  });

  it("applique la même tolérance au mode Stripe", async () => {
    const { stripeConfig: c1 } = await loadEnv({ STRIPE_MODE: " LIVE " });
    expect(c1().mode).toBe("live");
    const { stripeConfig: c2 } = await loadEnv({ STRIPE_MODE: "production" });
    expect(c2().mode).toBe("live");
    // Valeur incomprise : repli sur le monde qui n'encaisse pas pour de vrai.
    const { stripeConfig: c3 } = await loadEnv({ STRIPE_MODE: "prod" });
    expect(c3().mode).toBe("test");
  });

  it("par défaut, c'est encore Monetico qui encaisse", async () => {
    const { paymentProvider } = await loadEnv({});
    expect(paymentProvider()).toBe("monetico");
  });
});
