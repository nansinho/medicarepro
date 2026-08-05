import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";
import { formatEuros } from "@/lib/checkout/pricing";
import { logAudit } from "@/lib/audit";
import type { StripeFacts } from "@/lib/billing/attach";

/* ============================================================
   Le paiement d'un dossier d'INSCRIPTION, chez Stripe.

   POURQUOI C'EST UN CHEMIN À PART. Le tunnel de vente et l'espace abonnement se
   ressemblent à l'écran, mais pas en base : le premier écrit dans
   `pending_signups` (un dossier dont le cabinet n'existe pas encore), le second
   dans `subscription_orders` (une commande rattachée à un cabinet vivant).
   `finalizeOrderPayment` ne connaît que la seconde table ; envoyée sur un
   dossier d'inscription, elle ne trouve rien et ne dit rien.

   CE QUE FAIT CETTE ÉTAPE, ET RIEN DE PLUS : faire passer le dossier de
   « en attente du paiement » à « payé », et poser l'heure de reprise. Tout
   l'aval — création du compte dans l'application, contrat, facture, reçu — est
   piloté par la TABLE, par le worker, exactement comme du temps de Monetico.
   La notification ne fait qu'accélérer le premier passage ; si elle se perdait,
   le cron reprendrait le dossier.

   LE MONTANT NE BLOQUE PAS. Chez Monetico, un écart de centime posait
   `amount_mismatch` et le dossier n'était jamais provisionné : le montant
   partait de chez nous, un écart signifiait donc une altération. Chez Stripe,
   c'est SON catalogue qui fait foi et nous n'envoyons que des identifiants de
   prix : un écart signifie que notre grille d'affichage a dérivé du catalogue.
   Refuser de créer le compte d'un client qui a payé serait la mauvaise réponse
   à notre propre erreur de vitrine. On alerte, et on provisionne.
   ============================================================ */

/** Alerte interne — best-effort, ne jette jamais. */
async function alerte(title: string, lines: string[]): Promise<void> {
  try {
    if (!hasBilling()) return;
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error(
      "[stripe-signup] échec alerte :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

type SignupRow = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  plan: string;
  cabinet: { name?: string } | null;
};

/* Les états depuis lesquels un paiement fait avancer le dossier. `superseded`
   en fait partie : une reprise a pu remplacer le dossier pendant que le client
   payait sur l'ancienne page, et cet argent-là est bien reçu. */
const PAYABLES = ["payment_pending", "superseded"];

export type SignupPaymentOutcome =
  | { kind: "paid"; signupId: string }
  | { kind: "not_a_signup" }
  | { kind: "already"; status: string };

/**
 * Marque payé le dossier d'inscription que porte cette référence.
 *
 * Le passage à `paid` est CONDITIONNÉ à l'état de départ dans la requête
 * elle-même (`.in("status", PAYABLES)`) : Postgres tranche, et deux
 * notifications concurrentes ne peuvent pas produire deux provisionnements.
 * C'est le même verrou que le `for update` de la fonction SQL de l'IPN, obtenu
 * sans fonction SQL.
 */
export async function applyStripeSignupPayment(
  supabase: SupabaseClient,
  input: {
    reference: string;
    amountCents: number | null;
    currency: string | null;
    occurredAt: Date;
    sessionId: string | null;
    stripe: StripeFacts;
  },
): Promise<SignupPaymentOutcome> {
  const { data } = await supabase
    .from("pending_signups")
    .select("id, status, amount_cents, currency, plan, cabinet")
    .eq("monetico_reference", input.reference)
    .maybeSingle();
  if (!data) return { kind: "not_a_signup" };

  const row = data as SignupRow;
  const cabinetName = row.cabinet?.name ?? "(cabinet inconnu)";

  if (!PAYABLES.includes(row.status)) {
    /* Déjà payé, déjà provisionné, ou clos. Une re-livraison de la même
       notification tombe ici et ne doit RIEN faire. On ne le signale que si
       l'état est franchement anormal : un dossier abandonné qui reçoit un
       paiement est de l'argent encaissé sans contrepartie. */
    if (row.status === "abandoned" || row.status === "failed_conflict") {
      await alerte("Paiement Stripe sur un dossier clos", [
        `Cabinet : ${cabinetName}`,
        `Référence : ${input.reference}`,
        `État du dossier : ${row.status}`,
        `Montant : ${formatEuros(input.amountCents ?? row.amount_cents)}`,
        `Abonnement Stripe : ${input.stripe.subscriptionId}`,
        "Le client a payé mais son dossier ne sera pas provisionné. Régulariser à la main (créer le compte ou rembourser et annuler l'abonnement Stripe).",
      ]);
    }
    return { kind: "already", status: row.status };
  }

  const paidAt = input.occurredAt.toISOString();
  const { data: majData, error } = await supabase
    .from("pending_signups")
    .update({
      status: "paid",
      paid_at: paidAt,
      /* L'heure de reprise à MAINTENANT : c'est elle, et elle seule, qui rend
         le dossier visible au worker. Sans elle il resterait « payé » sans
         jamais être provisionné. */
      next_retry_at: paidAt,
      code_retour: "stripe_paid",
      stripe_checkout_session_id: input.sessionId,
      stripe_subscription_id: input.stripe.subscriptionId,
      stripe_customer_id: input.stripe.customerId,
      stripe_current_period_end: input.stripe.currentPeriodEnd.toISOString(),
      last_error: null,
    })
    .eq("id", row.id)
    .in("status", PAYABLES)
    .select("id");

  if (error) {
    /* On ne marque PAS l'événement traité en amont : Stripe re-livrera, et la
       reprise trouvera le dossier dans le même état. */
    throw new Error(`pending_signups → paid : ${error.message}`);
  }
  if (!majData || majData.length === 0) {
    /* Une autre livraison a gagné la course entre le SELECT et l'UPDATE. */
    return { kind: "already", status: row.status };
  }

  /* Écart de montant : signalé, jamais bloquant. Voir l'en-tête. */
  const paye = input.amountCents;
  if (paye !== null && paye !== row.amount_cents) {
    await alerte("Montant Stripe différent du montant annoncé", [
      `Cabinet : ${cabinetName}`,
      `Référence : ${input.reference}`,
      `Annoncé sur le site : ${formatEuros(row.amount_cents)}`,
      `Encaissé par Stripe : ${formatEuros(paye)}`,
      `Formule : ${row.plan}`,
      "Le compte SERA créé : c'est le catalogue Stripe qui fait foi. Vérifier la grille tarifaire affichée sur le site, qui a dérivé.",
    ]);
  }

  await logAudit({
    action: "checkout.paid",
    entityType: "pending_signup",
    entityId: row.id,
    diff: {
      reference: input.reference,
      provider: "stripe",
      amountCents: paye,
      subscription: input.stripe.subscriptionId,
    },
  });

  return { kind: "paid", signupId: row.id };
}

/**
 * Un paiement différé qui a échoué (prélèvement SEPA rejeté), ou une page de
 * paiement expirée.
 *
 * POURQUOI ÇA COMPTE. Avec le prélèvement SEPA, la session Checkout se termine
 * AVANT que l'argent n'arrive : Stripe confirme le paiement des jours plus tard,
 * ou le rejette. Sans ce chemin, un client dont le prélèvement est refusé reste
 * indéfiniment sur « nous attendons la confirmation de votre paiement ».
 *
 * On ne clôt pas le dossier : `payment_pending` avec un motif est exactement ce
 * que faisait un refus Monetico, et c'est ce que l'écran de suivi sait lire.
 */
export async function noteStripeSignupFailure(
  supabase: SupabaseClient,
  input: { reference: string; reason: "refused" | "expired" },
): Promise<{ noted: boolean }> {
  const { data } = await supabase
    .from("pending_signups")
    .select("id, status")
    .eq("monetico_reference", input.reference)
    .maybeSingle();
  if (!data) return { noted: false };

  const row = data as { id: string; status: string };
  /* Un dossier déjà payé ne redevient pas impayé : le rejet porte alors sur
     autre chose (une échéance), et ce n'est pas ce chemin qui la traite. */
  if (row.status !== "payment_pending") return { noted: false };

  await supabase
    .from("pending_signups")
    .update({ code_retour: `stripe_${input.reason}` })
    .eq("id", row.id)
    .eq("status", "payment_pending");

  return { noted: true };
}
