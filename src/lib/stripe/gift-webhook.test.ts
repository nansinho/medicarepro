import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

/* ============================================================
   Une session Stripe GRATUITE n'ouvre un compte que si elle vient d'une
   invitation.

   C'est la seule porte que l'accès offert a ouverte dans le webhook, et elle
   doit rester étroite : une session « rien à payer » sans invitation (un code
   promo à 100 % activé un jour dans le tableau de bord, par exemple) créerait
   un compte gratuit, sans limite de durée, sans que personne l'ait décidé.
   ============================================================ */

const statutAbonnement = { value: "trialing" };

vi.mock("@/lib/stripe/client", () => ({
  stripe: () => ({
    subscriptions: {
      retrieve: async () => ({
        status: statutAbonnement.value,
        items: { data: [{ current_period_end: 1_806_000_000 }] },
      }),
    },
  }),
  stripeLiveMode: () => false,
}));

vi.mock("@/lib/billing/instalments", () => ({
  openAnchoredAnnualSubscription: async () => {
    throw new Error("non attendu dans ces tests");
  },
}));

function evenement(session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return {
    id: "evt_test",
    created: 1_790_000_000,
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_test",
        mode: "subscription",
        client_reference_id: "MPABCDEFGH12",
        subscription: "sub_test",
        customer: "cus_test",
        amount_total: 0,
        currency: "eur",
        metadata: {},
        ...session,
      },
    },
  } as unknown as Stripe.Event;
}

beforeEach(() => {
  statutAbonnement.value = "trialing";
});

describe("factsFromCompletedSession — accès offert", () => {
  it("refuse une session gratuite SANS invitation", async () => {
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({ payment_status: "no_payment_required" }),
    );
    expect(r.ok).toBe(false);
  });

  it("accepte une session gratuite portant son invitation, abonnement en essai", async () => {
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({
        payment_status: "no_payment_required",
        metadata: { gift_invitation: "inv_1", reference: "MPABCDEFGH12" },
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      reference: "MPABCDEFGH12",
      amountCents: 0,
      giftInvitationId: "inv_1",
      stripe: { subscriptionId: "sub_test", customerId: "cus_test" },
    });
  });

  it("refuse une session « offerte » dont l'abonnement n'est PAS en essai", async () => {
    statutAbonnement.value = "active";
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({
        payment_status: "no_payment_required",
        metadata: { gift_invitation: "inv_1" },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("refuse une session gratuite hors abonnement, même avec invitation", async () => {
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({
        mode: "payment",
        payment_status: "no_payment_required",
        metadata: { gift_invitation: "inv_1" },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("une session payée reste acceptée, sans invitation attachée", async () => {
    statutAbonnement.value = "active";
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({ payment_status: "paid", amount_total: 2988 }),
    );
    expect(r).toMatchObject({ ok: true, amountCents: 2988 });
    expect(r.ok && "giftInvitationId" in r ? r.giftInvitationId : undefined).toBeUndefined();
  });

  it("une session en attente de paiement reste refusée", async () => {
    const { factsFromCompletedSession } = await import("@/lib/stripe/webhook");
    const r = await factsFromCompletedSession(
      evenement({ payment_status: "unpaid", metadata: { gift_invitation: "inv_1" } }),
    );
    expect(r.ok).toBe(false);
  });
});
