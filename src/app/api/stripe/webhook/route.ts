import { after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";
import { finalizeOrderPayment } from "@/lib/billing/attach";
import { registerPaymentFailure } from "@/lib/billing/dunning";
import { notifyRenewal } from "@/lib/provisioning";
import { mirrorStripeInvoice } from "@/lib/stripe/invoices";
import {
  eventMatchesEnvironment,
  factsFromCompletedSession,
  projectStripeEvent,
  verifyStripeEvent,
} from "@/lib/stripe/webhook";
import { stripeLiveMode } from "@/lib/stripe/client";

/* ============================================================
   POST /api/stripe/webhook — notifications de Stripe.

   L'ORDRE EST LA SEULE CHOSE QUI COMPTE ICI, et il a déjà été payé une fois.
   Le 04/08/2026, la route Monetico aiguillait les renouvellements annuels AVANT
   de les enregistrer : ils n'entraient donc jamais au journal. Ni trace, ni
   idempotence, et un refus sur ces références n'était traité nulle part.

   Donc, dans cet ordre, sans exception :
     1. authentifier la signature sur le CORPS BRUT ;
     2. refuser un événement venu de l'autre monde (essai / réel) ;
     3. JOURNALISER, avec `event_id` en clé d'unicité ;
     4. seulement ensuite, appliquer les effets.

   POURQUOI ON RÉPOND 200 À UN ÉVÉNEMENT QU'ON N'A PAS TRAITÉ. Stripe re-livre
   tant qu'il ne reçoit pas un 2xx, avec un intervalle croissant, pendant trois
   jours. Un 500 sur un événement qu'on ne sait pas traiter produirait des
   milliers de reprises inutiles et finirait par désactiver le point de
   terminaison — au moment précis où un vrai paiement en dépend. On accuse donc
   réception dès que l'événement est EN SÉCURITÉ dans le journal, et on garde
   `processed_at` à NULL tant que les effets n'ont pas été appliqués : un
   événement reçu mais non traité reste visible, au lieu de disparaître.

   RÈGLE ABSOLUE, héritée de la route Monetico : ne jamais journaliser le corps
   brut, la signature ni le secret.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe se contente du code HTTP ; le corps n'est lu que par un humain. */
function ack(message: string, status = 200): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain" },
  });
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

/** Alerte interne — best-effort, ne jette jamais. */
async function alerte(title: string, lines: string[]): Promise<void> {
  try {
    if (!hasBilling()) return;
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error(
      "[stripe-webhook] échec alerte :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function POST(request: NextRequest) {
  /* Corps BRUT, jamais re-sérialisé : re-parcourir le JSON change les espaces
     et invalide la signature, de façon totale et permanente. */
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const verified = verifyStripeEvent(rawBody, signature);
  if (!verified.ok) {
    /* Jamais le corps, jamais la signature : seulement la raison. Un refus de
       signature est soit une erreur de configuration, soit une tentative. */
    console.error("[stripe-webhook] signature refusée :", verified.reason);
    await alerte("Notification Stripe non authentifiée", [
      `Raison : ${verified.reason}`,
      "Si des paiements sont en cours, vérifier STRIPE_WEBHOOK_SECRET dans Coolify : tant qu'il est faux, AUCUN paiement n'est enregistré côté MediCare Pro.",
    ]);
    // 400 : Stripe le montre dans le tableau de bord, ce qu'on veut voir.
    return ack("signature refusée", 400);
  }

  const event = verified.event;

  if (!eventMatchesEnvironment(event)) {
    /* Une notification d'essai ne doit jamais toucher un contrat réel, ni
       l'inverse. On accuse réception pour couper la re-livraison, et on
       alerte : ce décalage veut dire qu'une clé et un point de terminaison ne
       parlent pas du même monde. */
    console.error(
      "[stripe-webhook] événement du mauvais monde :",
      event.type,
      "livemode =",
      event.livemode,
    );
    await alerte("Notification Stripe d'un autre environnement", [
      `Type : ${event.type}`,
      `Événement livemode : ${event.livemode}`,
      `Nos clés livemode : ${stripeLiveMode()}`,
      "Rien n'a été enregistré. Un point de terminaison de test pointe sur la production, ou l'inverse.",
    ]);
    return ack("environnement non concordant");
  }

  const supabase = serviceClient();
  if (!supabase) {
    /* Sans base, impossible de journaliser — donc impossible de garantir qu'on
       ne traitera pas deux fois. On demande la re-livraison plutôt que de
       risquer un double effet. */
    console.error("[stripe-webhook] base non configurée : re-livraison demandée.");
    return ack("base indisponible", 503);
  }

  const record = projectStripeEvent(event);

  /* JOURNAL D'ABORD. L'insertion est la garde anti-rejeu : `event_id` est
     unique, donc une re-livraison échoue ici et n'atteint jamais les effets. */
  const { error: journalError } = await supabase.from("stripe_events").insert({
    event_id: record.eventId,
    type: record.type,
    livemode: record.livemode,
    reference: record.reference,
    stripe_object_id: record.stripeObjectId,
    amount_cents: record.amountCents,
    currency: record.currency,
    payload: record.payload,
  });

  if (journalError) {
    // 23505 = violation d'unicité : déjà reçu, déjà en sécurité.
    if (journalError.code === "23505") {
      return ack("déjà reçu");
    }
    console.error("[stripe-webhook] journal :", journalError.message);
    // Non journalisé = non traité : on demande la re-livraison.
    return ack("journal indisponible", 503);
  }

  /* EFFETS. Après le journal, jamais avant : c'est l'ordre qui a manqué le
     04/08/2026, quand un renouvellement était aiguillé avant d'être enregistré
     et n'entrait donc jamais dans le journal.

     Ils tournent dans `after()` : Stripe attend son acquittement en quelques
     secondes, et une création de cabinet peut prendre plus longtemps. Le
     journal étant déjà écrit, un échec ici ne perd rien — il laisse
     `processed_at` à NULL, ce qui rend l'oubli visible. */
  after(async () => {
    try {
      await applyStripeEvent(event, record.eventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stripe-webhook] effets :", message);
      await supabase
        .from("stripe_events")
        .update({ process_error: message.slice(0, 500) })
        .eq("event_id", record.eventId);
      await alerte("Événement Stripe reçu mais non traité", [
        `Type : ${record.type}`,
        `Référence : ${record.reference ?? "(absente)"}`,
        `Erreur : ${message.slice(0, 300)}`,
        "L'événement est enregistré : il peut être rejoué depuis le tableau de bord Stripe une fois la cause corrigée.",
      ]);
    }
  });

  return ack("reçu");
}

/**
 * Applique les effets métier d'un événement déjà journalisé.
 *
 * Chaque branche marque `processed_at` elle-même, à la fin : ce qui distingue
 * « reçu » de « traité ». Un type qu'on ne traite pas reste donc visible comme
 * non traité, au lieu de se confondre avec un succès.
 */
async function applyStripeEvent(
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

  if (event.type === "checkout.session.completed") {
    const faits = await factsFromCompletedSession(event);
    if (!faits.ok) {
      /* Pas une erreur : une session peut aboutir sans paiement acquis
         (prélèvement SEPA en cours). On le note sans alerter. */
      await supabase
        .from("stripe_events")
        .update({ process_error: `ignoré : ${faits.reason}` })
        .eq("event_id", eventId);
      return;
    }
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
    await alerte("Échéance non remontée à l'application", [
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
