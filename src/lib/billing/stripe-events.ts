import "server-only";
import type Stripe from "stripe";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";
import { finalizeOrderPayment } from "@/lib/billing/attach";
import {
  applyStripeSignupPayment,
  noteStripeSignupFailure,
} from "@/lib/billing/stripe-signup";
import { processDuePendingSignups } from "@/lib/billing/worker";
import { registerPaymentFailure } from "@/lib/billing/dunning";
import { notifyRenewal } from "@/lib/provisioning";
import { mirrorStripeInvoice } from "@/lib/stripe/invoices";
import { factsFromCompletedSession } from "@/lib/stripe/webhook";

/* ============================================================
   LES EFFETS D'UNE NOTIFICATION STRIPE, séparés de la route qui la reçoit.

   POURQUOI C'EST UN MODULE ET PLUS UNE FONCTION DE LA ROUTE. La route accuse
   TOUJOURS réception par un 200 dès que l'événement est en sécurité dans le
   journal, et l'unicité de `event_id` fait échouer toute re-livraison avant les
   effets. Autrement dit : Stripe ne rejoue jamais rien pour nous.

   Le code portait pourtant le commentaire inverse — « le contrat n'existe pas
   encore, Stripe re-livrera » — et c'était faux. Constaté le 05/08/2026 : trois
   `invoice.paid` et deux `checkout.session.completed` dormaient dans le journal,
   jamais appliqués, et AUCUNE facture Stripe n'avait été copiée dans notre
   registre. La facture du premier client n'apparaissait nulle part chez nous.

   C'est donc à NOUS de rejouer, depuis le journal qui existe précisément pour
   ça. D'où ce module, appelé par la route pour le premier passage et par le
   cron pour les reprises.
   ============================================================ */

/** Alerte interne — best-effort, ne jette jamais. */
export async function alerteStripe(
  title: string,
  lines: string[],
): Promise<void> {
  try {
    if (!hasBilling()) return;
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error(
      "[stripe-events] échec alerte :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Une date telle qu'on l'écrit dans un email : « 17 août 2026 ». */
function frDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Applique les effets métier d'un événement déjà journalisé.
 *
 * Chaque branche marque `processed_at` elle-même, à la fin : ce qui distingue
 * « reçu » de « traité ». Un type qu'on ne traite pas reste donc visible comme
 * non traité, au lieu de se confondre avec un succès.
 */
export async function applyStripeEvent(
  event: Stripe.Event,
  eventId: string,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const marquerTraite = async () => {
    await supabase
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), process_error: null })
      .eq("event_id", eventId);
  };

  /* `async_payment_succeeded` accompagne `completed` pour les moyens de paiement
     différés : avec le prélèvement SEPA, la session se termine AVANT que l'argent
     n'arrive, et c'est ce second événement qui l'annonce. Le traiter comme le
     premier est exact — les deux portent la même session aboutie et payée — et
     l'omettre laisserait tout client payant par SEPA sans compte. */
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const faits = await factsFromCompletedSession(event);
    if (!faits.ok) {
      /* Pas une erreur : une session peut aboutir sans paiement acquis
         (prélèvement SEPA en cours). On le note sans alerter — le
         `async_payment_succeeded` viendra, ou le `async_payment_failed`. */
      await supabase
        .from("stripe_events")
        .update({ process_error: `ignoré : ${faits.reason}` })
        .eq("event_id", eventId);
      return;
    }

    /* Le tunnel de vente et l'espace abonnement n'écrivent pas dans la même
       table : un dossier d'inscription vit dans `pending_signups`, une commande
       dans `subscription_orders`. On essaie d'abord l'inscription, parce que
       `finalizeOrderPayment` ne trouverait rien et ne dirait rien. */
    const session = event.data.object as Stripe.Checkout.Session;
    const inscription = await applyStripeSignupPayment(supabase, {
      reference: faits.reference,
      amountCents: faits.amountCents,
      currency: faits.currency,
      occurredAt: faits.occurredAt,
      sessionId: session.id ?? null,
      stripe: faits.stripe,
    });

    if (inscription.kind === "not_a_signup") {
      await finalizeOrderPayment({
        reference: faits.reference,
        occurredAt: faits.occurredAt,
        amountCents: faits.amountCents,
        currency: faits.currency,
        /* Toujours faux ici : l'unicité de `event_id` a déjà écarté les
           re-livraisons avant qu'on arrive jusqu'à ces effets. */
        isReplay: false,
        stripe: faits.stripe,
      });
      await marquerTraite();
      return;
    }

    await marquerTraite();

    /* Provisioning hors du chemin d'acquittement : Stripe reçoit sa réponse
       tout de suite, le worker tourne après. Le claim est atomique côté base,
       donc un passage concurrent du cron ne peut pas doubler le travail. */
    if (inscription.kind === "paid") {
      try {
        await processDuePendingSignups(3);
      } catch (err) {
        /* Sans conséquence : le dossier est `paid` avec son heure de reprise
           échue, le cron le reprendra. */
        console.error(
          "[stripe-webhook] worker post-paiement :",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    return;
  }

  /* Un paiement différé refusé, ou une page de paiement abandonnée. Sans ces
     deux chemins, l'écran de suivi tourne indéfiniment sur « nous attendons la
     confirmation » pour un client dont le prélèvement a été rejeté. */
  if (
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const reference =
      session.client_reference_id ?? session.metadata?.reference ?? null;
    if (!reference) {
      await supabase
        .from("stripe_events")
        .update({ process_error: "ignoré : session sans référence" })
        .eq("event_id", eventId);
      return;
    }
    await noteStripeSignupFailure(supabase, {
      reference,
      reason:
        event.type === "checkout.session.expired" ? "expired" : "refused",
    });
    await marquerTraite();
    return;
  }

  /* UN ABONNEMENT QUI N'EXISTE PLUS CHEZ STRIPE.
     Deux causes : les relances d'impayé ont été épuisées, ou quelqu'un l'a
     supprimé depuis le tableau de bord Stripe. Dans les deux cas plus rien ne
     sera jamais prélevé.

     SANS CE CHEMIN, LE CABINET GARDE SON ACCÈS POUR TOUJOURS. Le cron
     d'expiration ne touche qu'aux contrats dont la reconduction est arrêtée
     (`expire_due_subscriptions` l'exige explicitement) : un contrat resté
     « actif » avec une reconduction qu'il croit vivante n'est jamais échu, et
     l'application continue d'ouvrir le logiciel à un cabinet qui ne paie plus.

     On ne coupe RIEN ici : on pose seulement la marque d'arrêt, et la mécanique
     existante applique la suite — période due jusqu'à son terme, puis quatorze
     jours de grâce, puis remontée EXPIRED à l'application. C'est l'engagement
     pris au client, et il ne dépend pas de la raison de l'arrêt. */
  if (event.type === "customer.subscription.deleted") {
    const abonnement = event.data.object as Stripe.Subscription;
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("id, cabinet_name, recurrence_stopped_at")
      .eq("stripe_subscription_id", abonnement.id)
      .maybeSingle();

    if (!subRow) {
      /* Aucun contrat : abonnement d'essai, ou supprimé avant que la
         souscription n'aboutisse. Rien à faire, et rien d'alarmant. */
      await supabase
        .from("stripe_events")
        .update({ process_error: `ignoré : aucun contrat pour ${abonnement.id}` })
        .eq("event_id", eventId);
      await marquerTraite();
      return;
    }

    const sub = subRow as {
      id: string;
      cabinet_name: string;
      recurrence_stopped_at: string | null;
    };

    /* Déjà marqué : c'est la fin normale d'une résiliation demandée par le
       praticien, elle a déjà été traitée et annoncée. */
    if (!sub.recurrence_stopped_at) {
      await supabase
        .from("subscriptions")
        .update({ recurrence_stopped_at: new Date(event.created * 1000).toISOString() })
        .eq("id", sub.id);

      /* Personne ne l'a demandé côté praticien : l'équipe doit le savoir, parce
         que c'est soit un impayé arrivé au bout, soit une manipulation dans le
         tableau de bord Stripe. Les deux méritent un regard humain. */
      await alerteStripe("Abonnement supprimé chez Stripe", [
        `Cabinet : ${sub.cabinet_name}`,
        `Abonnement Stripe : ${abonnement.id}`,
        `Motif Stripe : ${abonnement.cancellation_details?.reason ?? "(non précisé)"}`,
        "Aucune résiliation n'avait été demandée depuis l'espace abonnement. L'accès reste ouvert jusqu'au terme de la période réglée, puis quatorze jours de grâce, avant d'être fermé dans l'application.",
      ]);
    }

    await marquerTraite();
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const abonnement = subscriptionIdOf(invoice);
    if (!abonnement) {
      /* Une facture hors abonnement (ponctuelle, régularisation) ne concerne
         aucun contrat : on la note sans alerter. */
      await supabase
        .from("stripe_events")
        .update({ process_error: "ignoré : facture sans abonnement" })
        .eq("event_id", eventId);
      return;
    }

    /* On retrouve le contrat par l'abonnement Stripe, PAS par notre référence :
       les factures de reconduction ne la portent pas, seule la session
       d'origine l'avait. C'est la raison d'être de stripe_subscription_id. */
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("id, cabinet_name, app_cabinet_id, plan, currency, renewal_count, monetico_reference")
      .eq("stripe_subscription_id", abonnement)
      .maybeSingle();

    if (!subRow) {
      /* Le contrat n'existe pas encore : la facture de création arrive parfois
         avant que checkout.session.completed ait fini son travail. Stripe
         re-livrera, et le contrat sera là. On ne marque donc PAS traité. */
      await supabase
        .from("stripe_events")
        .update({
          process_error: `contrat introuvable pour ${abonnement} — sera rejoué`,
        })
        .eq("event_id", eventId);
      return;
    }

    const sub = subRow as {
      id: string;
      cabinet_name: string;
      app_cabinet_id: string;
      plan: "MONTHLY" | "ANNUAL";
      currency: string;
      renewal_count: number;
      monetico_reference: string;
    };

    if (event.type === "invoice.payment_failed") {
      /* NOTRE référence, pas le numéro de facture Stripe : la relance retrouve
         le contrat par elle, et c'est elle que porte `subscriptions`. Toute la
         mécanique d'impayé — délai de grâce de 14 jours, email au praticien,
         remontée PAST_DUE à l'application — fonctionne alors sans retouche. */
      await registerPaymentFailure({
        reference: sub.monetico_reference,
        occurredAt: new Date(event.created * 1000),
        codeRetour:
          invoice.last_finalization_error?.code ??
          `stripe:${invoice.status ?? "payment_failed"}`,
      });
      await marquerTraite();
      return;
    }

    await applyStripeInvoicePaid(supabase, invoice, sub, eventId);
    await marquerTraite();
    return;
  }

  /* UN ABONNEMENT MODIFIÉ. Nous sommes à l'origine de la quasi-totalité de ces
     événements : chaque changement de formule, chaque résiliation programmée et
     chaque paiement d'échéance en produit un, et notre registre est déjà à jour
     puisque c'est nous qui venons d'agir. Rien à faire, donc — mais il faut le
     DIRE, sinon la reprise le retenterait sept fois avant d'alerter pour rien.

     Ce qu'on perd à ne pas l'exploiter : une modification faite depuis le
     tableau de bord Stripe ne se répercuterait pas chez nous. C'est un geste
     d'exception, et `customer.subscription.deleted` couvre déjà le seul cas qui
     laisserait un cabinet payer — ou ne plus payer — sans qu'on le sache. */
  if (event.type === "customer.subscription.updated") {
    await supabase
      .from("stripe_events")
      .update({
        processed_at: new Date().toISOString(),
        process_error: "sans effet : notre registre est déjà à jour",
      })
      .eq("event_id", eventId);
    return;
  }

  /* Les autres types sont journalisés et attendent leur lot. `processed_at`
     reste NULL : un oubli se voit, il ne se confond pas avec un succès. */
}

/** L'abonnement porté par une facture, quelle que soit sa forme. */
function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as unknown as { subscription?: unknown }).subscription;
  if (typeof direct === "string" && direct) return direct;
  if (direct && typeof direct === "object" && "id" in direct) {
    const id = (direct as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  /* Versions récentes de l'API : l'abonnement vit sur la ligne de facture. */
  for (const line of invoice.lines?.data ?? []) {
    const p = (line as unknown as { subscription?: unknown }).subscription;
    if (typeof p === "string" && p) return p;
  }
  return null;
}

/**
 * Une échéance encaissée : registre, période, et remontée à l'application.
 *
 * La période N'EST PAS calculée : elle est lue sur la facture, dont la ligne
 * porte la fin de période que Stripe applique réellement. C'est la même règle
 * qu'à la souscription — recalculer ferait dériver notre date de la sienne, et
 * c'est la nôtre que le praticien lirait.
 */
async function applyStripeInvoicePaid(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  invoice: Stripe.Invoice,
  sub: {
    id: string;
    cabinet_name: string;
    app_cabinet_id: string;
    plan: "MONTHLY" | "ANNUAL";
    currency: string;
    renewal_count: number;
    monetico_reference: string;
  },
  eventId: string,
): Promise<void> {
  const paidCents = invoice.amount_paid ?? invoice.total ?? 0;
  const currency = (invoice.currency ?? sub.currency).toUpperCase();
  const occurredAt = new Date((invoice.created ?? Date.now() / 1000) * 1000);
  const premiere = invoice.billing_reason === "subscription_create";

  /* Le miroir d'abord : c'est lui qui remplace notre émission, et il est
     idempotent par l'identifiant de facture Stripe. */
  const miroir = await mirrorStripeInvoice(invoice, sub.id);
  if (!miroir.ok) {
    console.error("[stripe-webhook] miroir de facture :", miroir.reason);
  }

  /* La toute première facture est déjà comptabilisée par la finalisation de la
     session : la recompter doublerait l'écriture et le chiffre d'affaires. */
  if (premiere) return;

  const finDePeriode = periodEndOf(invoice);

  const { error: ledgerError } = await supabase.from("billing_ledger").insert({
    event_type: "card_renewal",
    payment_provider: "stripe",
    payment_environment: invoice.livemode ? "production" : "test",
    amount_cents: paidCents,
    currency,
    occurred_at: occurredAt.toISOString(),
    /* Stripe a prélevé : l'écriture naît encaissée, il n'y a rien à recouvrer. */
    captured_at: occurredAt.toISOString(),
    stripe_invoice_id: invoice.id ?? null,
    reference: invoice.number ?? invoice.id ?? eventId,
    subscription_id: sub.id,
    cabinet_name: sub.cabinet_name,
    meta: { kind: "stripe_renewal" },
  });
  if (ledgerError && ledgerError.code !== "23505") {
    throw new Error(`journal comptable : ${ledgerError.message}`);
  }

  if (finDePeriode) {
    await supabase
      .from("subscriptions")
      .update({
        current_period_end: finDePeriode.toISOString(),
        status: "active",
        renewal_count: sub.renewal_count + 1,
        last_renewal_at: occurredAt.toISOString(),
        /* Une échéance encaissée solde tout incident antérieur. */
        dunning_started_at: null,
        dunning_failure_count: 0,
        grace_until: null,
        last_failure_code: null,
      })
      .eq("id", sub.id);
  }

  const sync = await notifyRenewal({
    idempotencyKey: `stripe-${invoice.id ?? eventId}`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    periodEnd: finDePeriode?.toISOString(),
    paidAt: occurredAt.toISOString(),
    amountCents: paidCents,
    currency,
    status: "ACTIVE",
  });
  if (!sync.ok) {
    /* Une échéance encaissée mais non remontée laisse le logiciel du praticien
       sur l'ancienne date : il verra son abonnement expirer alors qu'il vient de
       payer. L'encaissement est bon, seule la date affichée est à reposer — mais
       personne ne le saura si ça ne sort que dans les journaux. */
    await alerteStripe("Échéance non remontée à l'application", [
      `Cabinet : ${sub.cabinet_name}`,
      `Cabinet applicatif : ${sub.app_cabinet_id}`,
      `Facture Stripe : ${invoice.number ?? invoice.id ?? "(inconnue)"}`,
      `Nouvelle échéance : ${finDePeriode ? frDate(finDePeriode) : "(inchangée)"}`,
      `Erreur : ${sync.reason}`,
      "L'encaissement, le contrat et la facture sont faits ; seule la date affichée dans l'application reste à poser à la main.",
    ]);
  }
}

/** La fin de période appliquée par Stripe, lue sur la ligne de facture. */
function periodEndOf(invoice: Stripe.Invoice): Date | null {
  for (const line of invoice.lines?.data ?? []) {
    const fin = line.period?.end;
    if (typeof fin === "number") return new Date(fin * 1000);
  }
  return null;
}
