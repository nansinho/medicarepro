import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* ============================================================
   LE RÈGLEMENT EN TROIS FOIS, CONTRE LE VRAI STRIPE D'ESSAI.

   POURQUOI CE FICHIER EXISTE. Les tests voisins vérifient ce que nous
   CONSTRUISONS ; celui-ci vérifie ce que Stripe en FAIT. La distinction n'est
   pas théorique : le montage retenu repose entièrement sur un comportement que
   rien dans notre code ne garantit — qu'un abonnement ancré à douze mois et
   privé de prorata ne prélève RIEN à l'ouverture. Si Stripe change d'avis, ou
   si un paramètre est mal orthographié, le praticien est débité de 397,41 €
   au lieu de 99,36 € et aucun test hors ligne ne le verra.

   Trois montages ont été mesurés le 06/08/2026 avant de retenir celui-ci :

     ancrage seul .................. 397,41 € prélevés (l'année EN PLUS)
     période d'essai de 12 mois .... bon montant, mais Stripe imprime une
                                     ligne « Essai gratuit » sur une facture
                                     pourtant payée, et une facture finalisée
                                     n'est plus modifiable
     paiement + ancrage sans prorata  le bon montant ET une facture lisible

   AUCUN ARGENT RÉEL N'EST EN JEU : clés d'essai uniquement, et le test refuse
   de partir en mode réel. Il ne crée aucun paiement — seulement un client et
   un abonnement d'essai, tous deux supprimés à la fin.

   Hors CI (réseau + ressources chez Stripe) :  set STRIPE_LIVE_TEST=1
   ============================================================ */

const live = process.env.STRIPE_LIVE_TEST === "1";

/* Vitest ne charge pas les fichiers d'environnement de Next : sans ça, le test
   partirait sans clé et échouerait pour une raison qui n'a rien à voir avec ce
   qu'il vérifie. On ne lit QUE les clés d'essai. */
if (live) {
  /* Balayage par expression régulière multiligne : lire ligne à ligne
     demanderait un séparateur échappé, et les couches de shell le mangent. */
  const env = readFileSync(".env.local", "utf-8");
  const motif = /^(STRIPE_[A-Z_]*TEST)=(.*)$/gm;
  let trouve: RegExpExecArray | null;
  while ((trouve = motif.exec(env)) !== null) {
    process.env[trouve[1]] = trouve[2].trim();
  }
  /* Imposé, jamais lu : même si le fichier dit « live », ce test ne touche
     que la plateforme d'essai. */
  process.env.STRIPE_MODE = "test";
}

describe.skipIf(!live)("règlement en trois fois — Stripe d'essai", () => {
  it(
    "ouvre douze mois d'accès sans prélever un centime de plus",
    { timeout: 120_000 },
    async () => {
      /* Garde-fou : ce test crée des ressources. En mode réel il en créerait
         chez de vrais clients, sur le compte qui encaisse. */
      process.env.STRIPE_MODE = "test";
      const { stripe } = await import("@/lib/stripe/client");
      const { openAnchoredAnnualSubscription } = await import(
        "@/lib/billing/instalments"
      );
      const { instalmentAmountsCents, checkoutAmountCents } = await import(
        "@/lib/checkout/pricing"
      );

      const s = stripe();
      const client = await s.customers.create({
        name: "Cabinet de vérification (versements)",
        email: "verification-versements@example.invalid",
      });
      const carte = await s.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await s.paymentMethods.attach(carte.id, { customer: client.id });

      try {
        const paidAt = new Date();
        /* NOTRE fonction, celle que le webhook appelle réellement — pas une
           reproduction de ses appels. C'est toute la valeur de ce test. */
        const ouvert = await openAnchoredAnnualSubscription({
          reference: `MPVERIF${Date.now().toString(36).toUpperCase().slice(-5)}`,
          customerId: client.id,
          paymentMethodId: carte.id,
          plan: "ANNUAL",
          extraCollaborators: 0,
          paidAt,
        });

        const abo = await s.subscriptions.retrieve(ouvert.subscriptionId);

        /* 1. RIEN N'EST PRÉLEVÉ. Le praticien a déjà réglé son 1er versement
              par ailleurs ; toute facture ici serait un second débit. */
        const factures = await s.invoices.list({
          subscription: ouvert.subscriptionId,
          limit: 10,
        });
        expect(factures.data).toHaveLength(0);

        /* 2. L'ABONNEMENT EST ACTIF, pas « en essai ». Le statut se lit sur la
              facture et dans le tableau de bord : « essai » sur un abonnement
              payé est faux, et c'est ce qui a fait abandonner l'autre montage. */
        expect(abo.status).toBe("active");
        expect(abo.trial_end).toBeFalsy();

        /* 3. LA PREMIÈRE FACTURATION TOMBE DANS DOUZE MOIS, à la journée près.
              Trop tôt, le praticien est débité de l'année pendant qu'il règle
              encore ses versements. */
        const jours = Math.round(
          (ouvert.currentPeriodEnd.getTime() - paidAt.getTime()) / 86_400_000,
        );
        expect(jours).toBeGreaterThanOrEqual(364);
        expect(jours).toBeLessThanOrEqual(366);

        /* 4. ELLE PORTERA LE PRIX PLEIN, pas un tiers : les versements couvrent
              la première année, la reconduction est une année entière. */
        const aVenir = await s.invoices.createPreview({
          subscription: ouvert.subscriptionId,
        });
        expect(aVenir.total).toBe(checkoutAmountCents("ANNUAL", 0));

        /* 5. LA CARTE EST BIEN CELLE DU PAIEMENT : sans elle, il n'y aurait
              rien à débiter au deuxième versement. */
        const moyen = abo.default_payment_method;
        expect(typeof moyen === "string" ? moyen : moyen?.id).toBe(carte.id);

        /* 6. LE DÉCOUPAGE TOMBE JUSTE sur ce que Stripe facturera vraiment. */
        const parts = instalmentAmountsCents(aVenir.total);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(aVenir.total);

        console.log(
          `abonnement ${abo.status}, 0 facture, reconduction dans ${jours} j ` +
            `pour ${(aVenir.total / 100).toFixed(2)} € — versements ${parts
              .map((p) => (p / 100).toFixed(2))
              .join(" + ")}`,
        );

        /* 7. IDEMPOTENCE. Un événement rejoué ne doit pas ouvrir un second
              abonnement, sinon le cabinet est prélevé deux fois dans un an. */
        const rejeu = await openAnchoredAnnualSubscription({
          reference: (abo.metadata?.reference ?? "") as string,
          customerId: client.id,
          paymentMethodId: carte.id,
          plan: "ANNUAL",
          extraCollaborators: 0,
          paidAt,
        });
        expect(rejeu.subscriptionId).toBe(ouvert.subscriptionId);

        await s.subscriptions.cancel(ouvert.subscriptionId);
      } finally {
        /* Le ménage passe quoi qu'il arrive : un test qui échoue ne doit pas
           laisser derrière lui des ressources à trier à la main. */
        await s.customers.del(client.id).catch(() => {});
      }
    },
  );

  /* Le mensuel est déjà un étalement. Ce refus vit dans notre code, mais le
     vérifier ici garantit qu'aucun abonnement ne part chez Stripe entre-temps. */
  it("refuse d'ouvrir un échelonnement sur la formule mensuelle", async () => {
    process.env.STRIPE_MODE = "test";
    const { openAnchoredAnnualSubscription } = await import(
      "@/lib/billing/instalments"
    );
    await expect(
      openAnchoredAnnualSubscription({
        reference: "MPVERIFMENSUEL",
        customerId: "cus_inexistant",
        plan: "MONTHLY",
        extraCollaborators: 0,
        paidAt: new Date(),
      }),
    ).rejects.toThrow(/12 mois/);
  });
});
