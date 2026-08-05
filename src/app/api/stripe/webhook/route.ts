import { after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";
import { finalizeOrderPayment } from "@/lib/billing/attach";
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

  /* Les autres types sont journalisés et attendent leur lot. `processed_at`
     reste NULL : un oubli se voit, il ne se confond pas avec un succès. */
}
