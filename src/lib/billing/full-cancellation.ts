import "server-only";
import { stripe } from "@/lib/stripe/client";
import { serviceClient } from "@/lib/supabase/service";
import { notifyRenewal } from "@/lib/provisioning";
import { alerteStripe } from "@/lib/billing/stripe-events";
import { formatEuros } from "@/lib/checkout/pricing";

/* ============================================================
   ANNULATION TOTALE d'un abonnement.

   À NE PAS CONFONDRE AVEC UNE RÉSILIATION. Une résiliation est le geste normal
   d'un praticien qui s'en va : elle prend effet au terme de la période réglée,
   l'accès lui reste dû, et rien n'est remboursé. C'est un engagement écrit.

   Ceci est l'exception : erreur de souscription, double compte, fraude,
   litige, cabinet qui n'aurait jamais dû être créé. On défait tout, tout de
   suite — l'argent revient, l'abonnement meurt, l'accès ferme.

   TROIS SYSTÈMES DOIVENT BOUGER ENSEMBLE, et c'est là que ça se joue :

     1. Stripe    — rembourser, puis supprimer l'abonnement.
     2. Chez nous — le contrat passe résilié, la reconduction est marquée close.
     3. Dev B     — l'accès au logiciel se ferme.

   N'en faire que deux laisse un cabinet remboursé qui travaille encore, ou un
   cabinet coupé qui continue d'être prélevé. C'est précisément le genre de
   rattrapage manuel qui se découvre trois mois plus tard chez le comptable.

   L'ORDRE N'EST PAS ARBITRAIRE. On rembourse EN PREMIER : c'est l'étape qui
   peut échouer (paiement trop ancien, déjà remboursé), et échouer avant d'avoir
   touché au reste laisse une situation intacte et reprenable. Supprimer
   l'abonnement d'abord rendrait le remboursement plus difficile à retrouver.
   ============================================================ */

export type FullCancellationResult = {
  refundedCents: number;
  /** Renseigné quand le remboursement n'a pas pu être fait. */
  refundIssue?: string;
  appNotified: boolean;
};

/**
 * Défait un abonnement de bout en bout.
 *
 * Ne jette que si l'abonnement est introuvable ou n'est pas un abonnement
 * Stripe : tout le reste est rapporté dans le résultat, parce qu'une annulation
 * à moitié faite doit être VISIBLE, jamais silencieuse.
 */
export async function cancelSubscriptionFully(input: {
  subscriptionId: string;
  /** Motif écrit, repris dans le journal d'audit et l'alerte. */
  reason: string;
  actor: string;
}): Promise<FullCancellationResult> {
  const supabase = serviceClient();
  if (!supabase) throw new Error("Base non configurée.");

  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, cabinet_name, app_cabinet_id, plan, status, currency, stripe_subscription_id, monetico_reference",
    )
    .eq("id", input.subscriptionId)
    .maybeSingle();
  if (!data) throw new Error("Abonnement introuvable.");

  const sub = data as {
    id: string;
    cabinet_name: string;
    app_cabinet_id: string;
    plan: "MONTHLY" | "ANNUAL";
    status: string;
    currency: string;
    stripe_subscription_id: string | null;
    monetico_reference: string;
  };

  if (!sub.stripe_subscription_id) {
    throw new Error(
      "Cet abonnement n'est pas rattaché à Stripe : l'annulation totale doit être faite à la main.",
    );
  }

  const s = stripe();
  let refundedCents = 0;
  let refundIssue: string | undefined;

  /* 1. REMBOURSER. On rend le dernier encaissement, en totalité.

     On passe par la dernière facture PAYÉE plutôt que par l'historique des
     transactions : c'est elle qui porte le montant réellement dû au titre de la
     période en cours, TVA comprise. */
  try {
    const factures = await s.invoices.list({
      subscription: sub.stripe_subscription_id,
      status: "paid",
      limit: 1,
    });
    const derniere = factures.data[0];
    const paye = derniere?.amount_paid ?? 0;

    if (!derniere || paye <= 0) {
      refundIssue = "aucune facture payée à rembourser";
    } else {
      const charge =
        (derniere as unknown as { charge?: unknown }).charge ??
        (derniere as unknown as { payments?: { data?: unknown[] } }).payments
          ?.data?.[0];
      const chargeId =
        typeof charge === "string"
          ? charge
          : ((charge as { id?: string } | undefined)?.id ?? null);

      if (chargeId) {
        const remb = await s.refunds.create(
          { charge: chargeId, reason: "requested_by_customer" },
          /* Idempotent sur l'abonnement : un double clic sur le bouton ne
             produit pas deux remboursements. */
          { idempotencyKey: `annulation-totale:${sub.stripe_subscription_id}` },
        );
        refundedCents = remb.amount ?? 0;
      } else {
        /* Facture payée sans transaction rattachée : avoir hors carte, solde
           client, ou paiement d'un autre canal. On ne devine pas. */
        refundIssue = `facture ${derniere.number ?? derniere.id} sans transaction rattachée`;
      }
    }
  } catch (err) {
    refundIssue = err instanceof Error ? err.message.slice(0, 200) : "erreur inconnue";
  }

  /* 2. SUPPRIMER L'ABONNEMENT chez Stripe. Immédiatement, pas au terme : on
     défait, on ne programme pas une fin. */
  try {
    await s.subscriptions.cancel(sub.stripe_subscription_id, {
      /* Aucune facture de dernière minute : on ne réclame pas le temps
         consommé à quelqu'un qu'on rembourse. */
      prorate: false,
      invoice_now: false,
    });
  } catch (err) {
    /* Déjà supprimé : c'est le résultat voulu, on continue. */
    const m = err instanceof Error ? err.message : "";
    if (!m.includes("No such subscription") && !m.includes("canceled")) {
      throw err;
    }
  }

  /* 3. CHEZ NOUS. L'accès s'arrête aujourd'hui : la période n'est plus due
     puisqu'elle a été remboursée. */
  const maintenant = new Date().toISOString();
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      recurrence_stopped_at: maintenant,
      current_period_end: maintenant,
      dunning_started_at: null,
      dunning_failure_count: 0,
      grace_until: null,
      last_failure_code: null,
    })
    .eq("id", sub.id);

  /* 4. DEV B. Sans cette remontée, le praticien remboursé continue d'ouvrir son
     logiciel — et c'est exactement le trou qu'on cherche à fermer. */
  const sync = await notifyRenewal({
    idempotencyKey: `annulation-totale-${sub.id}`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    status: "CANCELED",
    periodEnd: maintenant,
  });

  await alerteStripe("Annulation TOTALE d'un abonnement", [
    `Cabinet : ${sub.cabinet_name}`,
    `Référence : ${sub.monetico_reference}`,
    `Motif : ${input.reason}`,
    `Par : ${input.actor}`,
    refundedCents > 0
      ? `Remboursé : ${formatEuros(refundedCents)}`
      : `REMBOURSEMENT NON FAIT : ${refundIssue ?? "raison inconnue"} — à traiter à la main dans Stripe.`,
    "Abonnement supprimé chez Stripe, contrat résilié, accès fermé dans l'application.",
    sync.ok
      ? ""
      : `⚠️ L'application n'a PAS reçu la fermeture (${sync.reason}) : le praticien garde son accès tant qu'elle n'est pas posée à la main.`,
  ].filter(Boolean));

  return { refundedCents, refundIssue, appNotified: sync.ok };
}
