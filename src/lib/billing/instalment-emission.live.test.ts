import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* ============================================================
   L'ÉMISSION DES VERSEMENTS 2 ET 3, DE BOUT EN BOUT.

   C'EST LE MAILLON DONT DÉPEND LE PLUS D'ARGENT. Stripe ne connaît pas nos
   versements : il ne se réveille qu'au douzième mois. Les deux tiers du prix
   n'existent que parce que notre cron les réclame. Si cette chaîne casse, un
   cabinet règle 99,36 € pour douze mois d'accès et personne ne s'en aperçoit
   avant la comptabilité.

   Elle traverse trois mondes, et aucun test hors ligne ne les relie :
   la réservation atomique en base, l'émission chez Stripe, puis le retour de
   la facture dans notre registre.

   CE QUE CE TEST NE FAIT PAS :
     - il n'appelle jamais l'application de Geoffrey (renouvellement neutralisé) ;
     - il n'encaisse rien de réel (clés d'essai imposées) ;
     - il ne laisse rien derrière lui : le contrat d'essai, l'abonnement et le
       client Stripe sont supprimés même si le test échoue.

   Hors CI (réseau + base + Stripe) :  set STRIPE_LIVE_TEST=1
   ============================================================ */

const live = process.env.STRIPE_LIVE_TEST === "1";

if (live) {
  const env = readFileSync(".env.local", "utf-8");
  /* TOUT l'environnement, pas seulement Stripe : `billingEnv()` refuse de
     répondre tant qu'une seule variable manque, et il est interrogé jusque dans
     le chemin qu'on neutralise. */
  const motif = /^([A-Z][A-Z0-9_]*)=(.*)$/gm;
  let trouve: RegExpExecArray | null;
  while ((trouve = motif.exec(env)) !== null) {
    process.env[trouve[1]] = trouve[2].trim();
  }
  /* Imposés APRÈS le chargement, sinon le fichier les écraserait. */
  process.env.STRIPE_MODE = "test";
  /* L'application de Geoffrey ne doit RIEN recevoir : le cabinet d'essai
     n'existe pas chez elle, et l'appel produirait une alerte pour rien. */
  process.env.PROVISIONING_RENEWAL_ENABLED = "false";
}

describe.skipIf(!live)("émission des versements", () => {
  it(
    "réclame le 2e versement, l'encaisse, et n'ampute pas l'accès",
    { timeout: 180_000 },
    async () => {
      const { stripe } = await import("@/lib/stripe/client");
      const { serviceClient } = await import("@/lib/supabase/service");
      const { emitDueInstalments, applyInstalmentPaid, instalmentFromInvoice } =
        await import("@/lib/billing/instalments");
      const { openAnchoredAnnualSubscription } = await import(
        "@/lib/billing/instalments"
      );

      const s = stripe();
      const db = serviceClient();
      if (!db) throw new Error("Base non configurée.");

      const marque = `VERIF${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const client = await s.customers.create({
        name: "Contrat de vérification (versements)",
        email: `${marque.toLowerCase()}@example.invalid`,
      });
      const carte = await s.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await s.paymentMethods.attach(carte.id, { customer: client.id });

      let contratId: string | null = null;
      let aboId: string | null = null;

      try {
        const paidAt = new Date();
        const ouvert = await openAnchoredAnnualSubscription({
          reference: `MP${marque}`,
          customerId: client.id,
          paymentMethodId: carte.id,
          plan: "ANNUAL",
          extraCollaborators: 0,
          paidAt,
        });
        aboId = ouvert.subscriptionId;

        /* Le contrat tel que le worker l'écrit après le 1er versement : un réglé,
           deux dus, et le suivant ÉCHU pour que le cron le réclame maintenant
           plutôt que dans un mois. */
        const echeanceAcces = ouvert.currentPeriodEnd.toISOString();
        const { data: cree, error } = await db
          .from("subscriptions")
          .insert({
            app_cabinet_id: `verif-${marque}`,
            app_user_id: `verif-${marque}`,
            cabinet_name: "CONTRÔLE VERSEMENTS (à supprimer)",
            cabinet_email: `${marque.toLowerCase()}@example.invalid`,
            admin_email: `${marque.toLowerCase()}@example.invalid`,
            admin_name: "Contrôle Versements",
            invoice_prefix: marque.slice(0, 6),
            plan: "ANNUAL",
            first_payment_cents: 9936,
            renewal_amount_cents: 29808,
            currency: "EUR",
            status: "active",
            started_at: paidAt.toISOString(),
            current_period_end: echeanceAcces,
            monetico_reference: `MP${marque}`,
            payment_provider: "stripe",
            payment_environment: "test",
            stripe_subscription_id: ouvert.subscriptionId,
            stripe_customer_id: client.id,
            instalment_total_count: 3,
            instalment_paid_count: 1,
            instalment_amounts_cents: [9936, 9936, 9936],
            next_instalment_at: new Date(Date.now() - 60_000).toISOString(),
          })
          .select("id")
          .single();
        if (error || !cree) throw new Error(`contrat d'essai : ${error?.message}`);
        contratId = cree.id as string;

        /* ---- LE CRON, POUR DE VRAI ---- */
        const bilan = await emitDueInstalments(20);
        expect(bilan.claimed).toBeGreaterThanOrEqual(1);
        expect(bilan.failed).toBe(0);

        /* La facture émise chez Stripe, retrouvée par NOTRE marque. */
        const factures = await s.invoices.list({ customer: client.id, limit: 5 });
        const versement = factures.data.find(
          (f) => f.metadata?.medicarepro_instalment_subscription === contratId,
        );
        expect(versement).toBeTruthy();
        expect(versement!.status).toBe("paid");
        expect(versement!.amount_paid).toBe(9936);
        /* Reconnue comme un versement, sans quoi le webhook la prendrait pour
           une reconduction et ramènerait l'accès à la date du jour. */
        const ref = instalmentFromInvoice(versement!);
        expect(ref).toMatchObject({ subscriptionId: contratId, index: 2 });

        /* ---- LE RETOUR DE LA FACTURE DANS NOTRE REGISTRE ---- */
        await applyInstalmentPaid(db, versement!, ref!);

        const { data: apres } = await db
          .from("subscriptions")
          .select(
            "instalment_paid_count, next_instalment_at, current_period_end, instalment_suspended_at, status",
          )
          .eq("id", contratId)
          .single();
        const c = apres as {
          instalment_paid_count: number;
          next_instalment_at: string | null;
          current_period_end: string;
          instalment_suspended_at: string | null;
          status: string;
        };

        expect(c.instalment_paid_count).toBe(2);
        /* Le 3e est programmé un mois plus tard, pas réclamé tout de suite. */
        expect(c.next_instalment_at).toBeTruthy();
        expect(new Date(c.next_instalment_at!).getTime()).toBeGreaterThan(Date.now());
        /* LE POINT QUI COÛTE LE PLUS CHER S'IL LÂCHE : la période d'accès ne
           bouge pas. Une facture ponctuelle finit AUJOURD'HUI ; la traiter comme
           une reconduction fermerait l'accès du praticien au moment où il paie. */
        expect(new Date(c.current_period_end).getTime()).toBe(
          new Date(echeanceAcces).getTime(),
        );
        expect(c.instalment_suspended_at).toBeNull();
        expect(c.status).toBe("active");

        /* ---- RIEN N'EST RÉCLAMÉ DEUX FOIS ---- */
        const second = await emitDueInstalments(20);
        expect(second.claimed).toBe(0);

        console.log(
          `versement 2 réclamé et encaissé (${versement!.amount_paid} cts), ` +
            `reste 1 sur 3, accès inchangé au ${c.current_period_end.slice(0, 10)}`,
        );
      } finally {
        if (contratId) await db.from("subscriptions").delete().eq("id", contratId);
        if (aboId) await s.subscriptions.cancel(aboId).catch(() => {});
        await s.customers.del(client.id).catch(() => {});
      }
    },
  );
});
