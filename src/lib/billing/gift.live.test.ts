import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

/* ============================================================
   L'ACCÈS OFFERT, CONTRE LE VRAI STRIPE D'ESSAI.

   Les tests voisins vérifient ce que nous CONSTRUISONS ; celui-ci vérifie ce
   que Stripe en FAIT. Tout le montage repose sur trois comportements que rien
   dans notre code ne garantit :

     1. la caisse accepte nos paramètres (essai jusqu'à une date, carte
        facultative, résiliation faute de carte, taux de TVA) ;
     2. SANS carte, rien n'est jamais prélevé, et l'abonnement est RÉSILIÉ à la
        fin de l'essai (c'est ce qui fait passer le logiciel en lecture seule) ;
     3. AVEC une carte enregistrée pendant l'essai, comme le fait le portail
        client, la première échéance est bien encaissée à la date prévue.

   Le temps est simulé par une horloge de test Stripe : six mois passent en
   quelques secondes. AUCUN ARGENT RÉEL : clés d'essai uniquement, et le test
   refuse de partir en mode réel. Tout ce qu'il crée est supprimé à la fin.

   Hors CI (réseau + ressources chez Stripe) :  set STRIPE_LIVE_TEST=1
   ============================================================ */

const live = process.env.STRIPE_LIVE_TEST === "1";

if (live) {
  const env = readFileSync(".env.local", "utf-8");
  const motif = /^(STRIPE_[A-Z_]*TEST)=(.*)$/gm;
  let trouve: RegExpExecArray | null;
  while ((trouve = motif.exec(env)) !== null) {
    process.env[trouve[1]] = trouve[2].trim();
  }
  process.env.STRIPE_MODE = "test";
  process.env.NEXT_PUBLIC_SITE_URL = "https://medicarepro.fr";
}

const JOUR = 86_400;

/**
 * Avance l'horloge jusqu'à une date et attend que Stripe ait tout rejoué.
 *
 * Par bonds de 50 jours au plus : Stripe refuse d'avancer une horloge de plus
 * de deux périodes de facturation d'un coup (deux mois pour un mensuel).
 */
async function avancer(s: Stripe, horloge: string, jusqua: number): Promise<void> {
  let courant = (await s.testHelpers.testClocks.retrieve(horloge)).frozen_time;
  while (courant < jusqua) {
    const cible = Math.min(jusqua, courant + 50 * JOUR);
    await s.testHelpers.testClocks.advance(horloge, { frozen_time: cible });
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) {
      const h = await s.testHelpers.testClocks.retrieve(horloge);
      pret = h.status === "ready";
      if (!pret) await new Promise((r) => setTimeout(r, 2_000));
    }
    if (!pret) throw new Error("L'horloge de test n'a pas fini d'avancer en deux minutes.");
    courant = cible;
  }
}

describe.skipIf(!live)("accès offert — Stripe d'essai", () => {
  it(
    "la caisse accepte les paramètres d'un accès offert, avec et sans carte",
    { timeout: 60_000 },
    async () => {
      process.env.STRIPE_MODE = "test";
      const { stripe } = await import("@/lib/stripe/client");
      const { buildCheckoutParams } = await import("@/lib/stripe/checkout");
      const { addGiftMonths } = await import("@/lib/billing/gift");
      const s = stripe();

      const client = await s.customers.create({
        name: "Cabinet de vérification (accès offert)",
        email: "verification-acces-offert@example.invalid",
        address: { line1: "1 rue du Test", postal_code: "75001", city: "Paris", country: "FR" },
      });
      try {
        for (const requireCard of [false, true]) {
          const params = buildCheckoutParams({
            reference: `MPGIFT${Date.now().toString(36).toUpperCase().slice(-6)}`,
            plan: "MONTHLY",
            extraCollaborators: 1,
            customerId: client.id,
            successPath: "/inscription/confirmation",
            errorPath: "/inscription/echec",
            metadata: { kind: "signup" },
            gift: {
              invitationId: "00000000-0000-4000-8000-000000000000",
              months: 6,
              endsAt: addGiftMonths(new Date(), 6),
              requireCard,
            },
          });
          const session = await s.checkout.sessions.create(params);
          expect(session.url).toBeTruthy();
          expect(session.payment_method_collection).toBe(requireCard ? "always" : "if_required");
          /* Rien à payer aujourd'hui, collaborateur compris. */
          expect(session.amount_total).toBe(0);
          await s.checkout.sessions.expire(session.id);
        }
      } finally {
        await s.customers.del(client.id).catch(() => {});
      }
    },
  );

  it(
    "sans carte : rien n'est prélevé, et l'abonnement est résilié à la fin de la période",
    { timeout: 240_000 },
    async () => {
      process.env.STRIPE_MODE = "test";
      const { stripe } = await import("@/lib/stripe/client");
      const { stripeConfig } = await import("@/lib/env");
      const { readGiftTrialState } = await import("@/lib/stripe/subscription");
      const s = stripe();
      const { prices, taxRate } = stripeConfig();

      const maintenant = Math.floor(Date.now() / 1000);
      const horloge = await s.testHelpers.testClocks.create({
        frozen_time: maintenant,
        name: "Accès offert sans carte",
      });
      try {
        const client = await s.customers.create({
          name: "Cabinet offert sans carte",
          email: "offert-sans-carte@example.invalid",
          test_clock: horloge.id,
        });
        const finEssai = maintenant + 90 * JOUR;
        /* Les mêmes paramètres que la caisse pose sur l'abonnement. */
        const abo = await s.subscriptions.create({
          customer: client.id,
          items: [{ price: prices.monthly!, quantity: 1 }],
          default_tax_rates: [taxRate!],
          trial_end: finEssai,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          metadata: { gift_invitation: "verification" },
        });
        expect(abo.status).toBe("trialing");

        /* Ce que lisent les rappels : pas de carte, pas d'arrêt demandé. */
        const etat = await readGiftTrialState(abo.id);
        expect(etat).toEqual({ status: "trialing", hasPaymentMethod: false, cancelAtPeriodEnd: false });

        const premiere = await s.invoices.list({ subscription: abo.id, limit: 5 });
        expect(premiere.data.every((f) => f.amount_paid === 0)).toBe(true);

        await avancer(s, horloge.id, finEssai + 2 * 3600);

        const apres = await s.subscriptions.retrieve(abo.id);
        expect(apres.status).toBe("canceled");
        const factures = await s.invoices.list({ subscription: abo.id, limit: 10 });
        const encaisse = factures.data.reduce((t, f) => t + (f.amount_paid ?? 0), 0);
        expect(encaisse).toBe(0);
        console.log(`sans carte : ${apres.status}, ${factures.data.length} facture(s), 0 € encaissé`);
      } finally {
        await s.testHelpers.testClocks.del(horloge.id).catch(() => {});
      }
    },
  );

  it(
    "carte ajoutée pendant la période (comme le portail) : la première échéance est encaissée",
    { timeout: 240_000 },
    async () => {
      process.env.STRIPE_MODE = "test";
      const { stripe } = await import("@/lib/stripe/client");
      const { stripeConfig } = await import("@/lib/env");
      const { readGiftTrialState } = await import("@/lib/stripe/subscription");
      const { checkoutAmountCents } = await import("@/lib/checkout/pricing");
      const s = stripe();
      const { prices, taxRate } = stripeConfig();

      const maintenant = Math.floor(Date.now() / 1000);
      const horloge = await s.testHelpers.testClocks.create({
        frozen_time: maintenant,
        name: "Accès offert, carte ajoutée ensuite",
      });
      try {
        const client = await s.customers.create({
          name: "Cabinet offert, carte ensuite",
          email: "offert-carte-ensuite@example.invalid",
          test_clock: horloge.id,
        });
        const finEssai = maintenant + 90 * JOUR;
        const abo = await s.subscriptions.create({
          customer: client.id,
          items: [{ price: prices.monthly!, quantity: 1 }],
          default_tax_rates: [taxRate!],
          trial_end: finEssai,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        });

        /* Le portail client enregistre la carte comme moyen par défaut DU CLIENT. */
        const carte = await s.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
        await s.paymentMethods.attach(carte.id, { customer: client.id });
        await s.customers.update(client.id, {
          invoice_settings: { default_payment_method: carte.id },
        });

        const etat = await readGiftTrialState(abo.id);
        expect(etat?.hasPaymentMethod).toBe(true);

        await avancer(s, horloge.id, finEssai + 2 * 3600);

        const apres = await s.subscriptions.retrieve(abo.id);
        expect(apres.status).toBe("active");
        const factures = await s.invoices.list({ subscription: abo.id, limit: 10 });
        const cycle = factures.data.find((f) => f.billing_reason === "subscription_cycle");
        expect(cycle?.status).toBe("paid");
        expect(cycle?.amount_paid).toBe(checkoutAmountCents("MONTHLY", 0));
        console.log(
          `carte ajoutée : ${apres.status}, première échéance ${((cycle?.amount_paid ?? 0) / 100).toFixed(2)} € encaissée`,
        );
      } finally {
        await s.testHelpers.testClocks.del(horloge.id).catch(() => {});
      }
    },
  );
});
