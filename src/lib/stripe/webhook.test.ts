import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
   Notifications Stripe : authentification et projection.

   CE QUE CES TESTS PROTÈGENT, et pourquoi ils existent dès le premier jour.

   Aucun test ne couvrait la route Monetico équivalente. Le 05/08/2026, il a
   fallu une journée pour établir qu'une notification dont le sceau n'était pas
   reconnu repartait en silence — sans log, sans alerte, sans trace. Le même
   trou côté Stripe voudrait dire : un client débité, et nous n'en savons rien.

   Deux propriétés sont vérifiées ici, et elles se compensent mal l'une
   l'autre. On n'agit pas sur un message non authentifié (sinon un
   `invoice.paid` fabriqué prolonge une période gratuitement), et on ne
   conserve pas ce qu'on n'a pas décidé de conserver (la charge utile de Stripe
   porte les quatre derniers chiffres de la carte et son pays d'émission).
   ============================================================ */

const SECRET = "whsec_TestSecretPourLesTests1234567890";

/**
 * Reproduit la signature de Stripe : `t=…,v1=HMAC-SHA256(t.corps)`.
 *
 * L'horodatage doit être RÉCENT : `constructEvent` refuse au-delà de cinq
 * minutes, pour qu'une notification interceptée ne puisse pas être rejouée des
 * heures plus tard. Un horodatage figé fait donc échouer tous les cas positifs,
 * de façon parfaitement trompeuse — le message parle de signature invalide.
 */
function signer(
  corps: string,
  secret = SECRET,
  horodatage = Math.floor(Date.now() / 1000),
) {
  const mac = createHmac("sha256", secret)
    .update(`${horodatage}.${corps}`)
    .digest("hex");
  return `t=${horodatage},v1=${mac}`;
}

function evenement(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    created: 1_754_400_000,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        client_reference_id: "MPABCDEFGH12",
        amount_total: 2988,
        currency: "eur",
        status: "complete",
        payment_status: "paid",
        customer: "cus_1",
        subscription: "sub_1",
        ...over,
      },
    },
  });
}

async function charger(overrides: Record<string, string> = {}) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SITE_URL = "https://medicarepro.fr";
  process.env.STRIPE_SECRET_KEY = "sk_test_51AbCdEfGhIjKlMnOp";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === "") delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/stripe/webhook");
}

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("STRIPE_")) delete process.env[k];
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyStripeEvent", () => {
  it("accepte une notification correctement signée", async () => {
    const { verifyStripeEvent } = await charger();
    const corps = evenement();
    const res = verifyStripeEvent(corps, signer(corps));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.event.id).toBe("evt_test_1");
  });

  it("refuse une signature calculée avec un autre secret", async () => {
    const { verifyStripeEvent } = await charger();
    const corps = evenement();
    const res = verifyStripeEvent(corps, signer(corps, "whsec_UnAutreSecret000000"));
    expect(res.ok).toBe(false);
  });

  /* L'erreur classique, et la plus traître : re-sérialiser le JSON avant de
     vérifier. La signature porte sur les octets reçus, espaces compris. */
  it("refuse un corps ré-encodé, même sémantiquement identique", async () => {
    const { verifyStripeEvent } = await charger();
    const corps = evenement();
    const signature = signer(corps);
    const reEncode = JSON.stringify(JSON.parse(corps), null, 2);
    expect(verifyStripeEvent(reEncode, signature).ok).toBe(false);
  });

  it("refuse sans en-tête de signature", async () => {
    const { verifyStripeEvent } = await charger();
    const corps = evenement();
    const res = verifyStripeEvent(corps, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("stripe-signature");
  });

  /* Sans secret configuré, on refuse TOUT plutôt que d'accepter tout : c'est
     le sens de la garde, et l'inverse serait une porte ouverte. */
  it("refuse tout quand le secret n'est pas configuré", async () => {
    const { verifyStripeEvent } = await charger({ STRIPE_WEBHOOK_SECRET: "" });
    const corps = evenement();
    const res = verifyStripeEvent(corps, signer(corps));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/secret de webhook/i);
  });
});

describe("eventMatchesEnvironment", () => {
  it("accepte un événement d'essai avec une clé d'essai", async () => {
    const { verifyStripeEvent, eventMatchesEnvironment } = await charger();
    const corps = evenement();
    const res = verifyStripeEvent(corps, signer(corps));
    expect(res.ok && eventMatchesEnvironment(res.event)).toBe(true);
  });

  /* Le décalage qui a rendu injoignables les sept abonnements existants côté
     Monetico : deux mondes, une seule configuration. */
  it("refuse un événement réel reçu avec une clé d'essai", async () => {
    const { verifyStripeEvent, eventMatchesEnvironment } = await charger();
    const corps = JSON.stringify({ ...JSON.parse(evenement()), livemode: true });
    const res = verifyStripeEvent(corps, signer(corps));
    expect(res.ok).toBe(true);
    if (res.ok) expect(eventMatchesEnvironment(res.event)).toBe(false);
  });
});

describe("projectStripeEvent", () => {
  async function projeter(corps: string) {
    const { verifyStripeEvent, projectStripeEvent } = await charger();
    const res = verifyStripeEvent(corps, signer(corps));
    if (!res.ok) throw new Error("signature refusée dans le test");
    return projectStripeEvent(res.event);
  }

  it("retient notre référence, le montant et l'objet Stripe", async () => {
    const p = await projeter(evenement());
    expect(p.eventId).toBe("evt_test_1");
    expect(p.reference).toBe("MPABCDEFGH12");
    expect(p.stripeObjectId).toBe("cs_test_1");
    expect(p.amountCents).toBe(2988);
    expect(p.currency).toBe("EUR");
    expect(p.payload).toMatchObject({ payment_status: "paid", subscription: "sub_1" });
  });

  /* Liste blanche, pas liste noire : ce qui n'est pas nommé n'entre pas. Une
     liste noire laisserait passer le champ que Stripe ajoutera demain. */
  it("ne conserve AUCUNE donnée de carte", async () => {
    const p = await projeter(
      evenement({
        payment_method_details: {
          card: { last4: "4242", brand: "visa", country: "FR", fingerprint: "abc" },
        },
        customer_details: { email: "praticien@example.fr", phone: "+33600000000" },
        charges: { data: [{ id: "ch_1", receipt_url: "https://…" }] },
      }),
    );
    const json = JSON.stringify(p);
    for (const interdit of ["4242", "visa", "fingerprint", "abc", "praticien@example.fr", "+33600000000", "ch_1"]) {
      expect(json).not.toContain(interdit);
    }
  });

  /* Le motif d'un refus est précisément ce qu'on a passé une journée à
     réclamer à la banque, faute de l'avoir conservé. */
  it("conserve le motif d'un refus", async () => {
    const p = await projeter(
      evenement({
        last_payment_error: {
          code: "card_declined",
          decline_code: "insufficient_funds",
          message: "Votre carte a été refusée.",
          payment_method: { card: { last4: "0341" } },
        },
      }),
    );
    expect(p.payload).toMatchObject({
      failure_code: "card_declined",
      failure_decline_code: "insufficient_funds",
    });
    expect(JSON.stringify(p)).not.toContain("0341");
  });

  it("trouve la référence aussi dans les métadonnées", async () => {
    const corps = JSON.stringify({
      id: "evt_2",
      object: "event",
      type: "invoice.paid",
      livemode: false,
      created: 1,
      data: {
        object: {
          id: "in_1",
          object: "invoice",
          metadata: { reference: "MPZYXWVUTS98" },
          amount_paid: 47808,
          currency: "eur",
          hosted_invoice_url: "https://invoice.stripe.com/x",
        },
      },
    });
    const { verifyStripeEvent, projectStripeEvent } = await charger();
    const res = verifyStripeEvent(corps, signer(corps));
    if (!res.ok) throw new Error("signature refusée");
    const p = projectStripeEvent(res.event);
    expect(p.reference).toBe("MPZYXWVUTS98");
    expect(p.amountCents).toBe(47808);
    expect(p.payload.hosted_invoice_url).toBe("https://invoice.stripe.com/x");
  });

  it("supporte un objet sans référence ni montant", async () => {
    const corps = JSON.stringify({
      id: "evt_3",
      object: "event",
      type: "customer.subscription.deleted",
      livemode: false,
      created: 1,
      data: { object: { id: "sub_9", object: "subscription", status: "canceled" } },
    });
    const { verifyStripeEvent, projectStripeEvent } = await charger();
    const res = verifyStripeEvent(corps, signer(corps));
    if (!res.ok) throw new Error("signature refusée");
    const p = projectStripeEvent(res.event);
    expect(p.reference).toBeNull();
    expect(p.amountCents).toBeNull();
    expect(p.payload.status).toBe("canceled");
  });
});
