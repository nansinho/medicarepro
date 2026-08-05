import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

/* ============================================================
   L'abonnement porté par une facture Stripe.

   CE QUE CE FICHIER PROTÈGE. Le 05/08/2026, toute la facturation Stripe est
   tombée sur ce seul point : les versions récentes de l'API ont RETIRÉ
   `invoice.subscription` et `line.subscription`, et l'abonnement a déménagé sous
   `parent`. Le code ne regardait que les anciens emplacements, concluait
   « facture sans abonnement », et s'arrêtait là — sans erreur, sans alerte.

   Les conséquences n'étaient pas cosmétiques : aucune facture copiée dans notre
   registre, AUCUNE reconduction pour prolonger la période — un praticien
   prélevé chaque mois par Stripe aurait vu son abonnement expirer chez nous et
   perdu l'accès à son logiciel — et aucun impayé relancé.

   Les charges utiles ci-dessous sont celles REÇUES de Stripe le 05/08/2026,
   relevées sur la facture in_1U18ZB… et réduites aux champs qui comptent.
   ============================================================ */

vi.mock("server-only", () => ({}));

/* Ce module tire toute la chaîne de facturation (base, emails, provisioning).
   On ne teste ici qu'une fonction de lecture pure : les dépendances sont
   neutralisées pour que l'import n'exige ni configuration ni réseau. */
vi.mock("@/lib/supabase/service", () => ({ serviceClient: () => null }));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/billing/attach", () => ({ finalizeOrderPayment: vi.fn() }));
vi.mock("@/lib/billing/stripe-signup", () => ({
  applyStripeSignupPayment: vi.fn(),
  noteStripeSignupFailure: vi.fn(),
}));
vi.mock("@/lib/billing/worker", () => ({ processDuePendingSignups: vi.fn() }));
vi.mock("@/lib/billing/dunning", () => ({ registerPaymentFailure: vi.fn() }));
vi.mock("@/lib/provisioning", () => ({ notifyRenewal: vi.fn() }));
vi.mock("@/lib/stripe/invoices", () => ({ mirrorStripeInvoice: vi.fn() }));
vi.mock("@/lib/stripe/webhook", () => ({ factsFromCompletedSession: vi.fn() }));

const SUB = "sub_1U18ZCGV4ZAyPFKitWF2fvsU";

/** La facture de création reçue le 05/08/2026, telle quelle. */
const FORME_ACTUELLE = {
  id: "in_1U18ZBGV4ZAyPFKiunExN4lR",
  billing_reason: "subscription_create",
  parent: {
    quote_details: null,
    subscription_details: {
      metadata: { reference: "MPMKMJFQXEER" },
      subscription: SUB,
    },
    type: "subscription_details",
  },
  lines: {
    data: [
      {
        period: { start: 1785950720, end: 1788629120 },
        parent: {
          invoice_item_details: null,
          subscription_item_details: {
            proration: false,
            subscription: SUB,
            subscription_item: "si_V1AvuGkYgifHbu",
          },
          type: "subscription_item_details",
        },
      },
    ],
  },
} as unknown as Stripe.Invoice;

async function charger() {
  return import("./stripe-events");
}

describe("subscriptionIdOf", () => {
  it("lit l'abonnement sous `parent` — la forme que Stripe envoie aujourd'hui", async () => {
    const { subscriptionIdOf } = await charger();
    expect(subscriptionIdOf(FORME_ACTUELLE)).toBe(SUB);
  });

  it("le trouve encore quand seule la LIGNE le porte sous `parent`", async () => {
    const { subscriptionIdOf } = await charger();
    const sansEnTete = {
      ...FORME_ACTUELLE,
      parent: { quote_details: null, subscription_details: null },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdOf(sansEnTete)).toBe(SUB);
  });

  it("accepte encore la forme historique `invoice.subscription`", async () => {
    const { subscriptionIdOf } = await charger();
    const ancienne = {
      id: "in_ancien",
      subscription: SUB,
      lines: { data: [] },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdOf(ancienne)).toBe(SUB);
  });

  it("accepte un abonnement développé en objet", async () => {
    const { subscriptionIdOf } = await charger();
    const developpe = {
      id: "in_dev",
      subscription: { id: SUB, object: "subscription" },
      lines: { data: [] },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdOf(developpe)).toBe(SUB);
  });

  /* Une facture ponctuelle ne concerne aucun contrat : la route la note et
     passe. Confondre ce cas avec le précédent, c'est soit ignorer une
     reconduction, soit prolonger une période sur une facture qui n'en est pas
     une. */
  it("rend null pour une facture hors abonnement", async () => {
    const { subscriptionIdOf } = await charger();
    const ponctuelle = {
      id: "in_ponctuelle",
      parent: { quote_details: null, subscription_details: null, type: null },
      lines: {
        data: [
          {
            period: { start: 1, end: 2 },
            parent: { invoice_item_details: {}, type: "invoice_item_details" },
          },
        ],
      },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdOf(ponctuelle)).toBeNull();
  });

  it("ne se laisse pas piéger par une facture sans lignes", async () => {
    const { subscriptionIdOf } = await charger();
    expect(subscriptionIdOf({ id: "in_vide" } as unknown as Stripe.Invoice)).toBeNull();
  });
});
