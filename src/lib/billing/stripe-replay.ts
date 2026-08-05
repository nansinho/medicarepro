import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/client";
import { alerteStripe, applyStripeEvent } from "@/lib/billing/stripe-events";

/* ============================================================
   Reprendre les notifications Stripe restées sans effet.

   POURQUOI CE MODULE EXISTE. Notre route accuse réception par un 200 dès que
   l'événement est en sécurité dans le journal, et l'unicité d'`event_id` fait
   échouer toute re-livraison AVANT les effets. Conséquence : Stripe ne rejoue
   jamais rien pour nous. Un événement dont les effets échouent est perdu, sauf
   si quelqu'un le reprend. Ce quelqu'un, c'est ce module.

   CE N'EST PAS UNE PRÉCAUTION THÉORIQUE. Le 05/08/2026, cinq événements
   dormaient dans le journal et la facture du premier client Stripe n'avait
   jamais rejoint notre registre. Le cas le plus courant est une course
   bénigne : la première facture d'un abonnement arrive dans la même seconde que
   la session de paiement, donc avant que le contrat n'existe. Quelques minutes
   plus tard, il est là.

   ON RELIT L'ÉVÉNEMENT CHEZ STRIPE plutôt que de le reconstruire depuis notre
   journal. Notre copie est volontairement filtrée — liste blanche, aucune donnée
   carte — et ne contient donc pas de quoi rejouer les effets. Stripe conserve
   ses événements trente jours ; au-delà, la reprise n'est plus possible et
   l'alerte le dit.
   ============================================================ */

/** Recul progressif : 5 min, 15, 45, 2 h 15, puis 6 h 45. */
function prochainDelaiMinutes(tentatives: number): number {
  return Math.min(5 * 3 ** tentatives, 405);
}

/**
 * Au-delà, on cesse de retenter et on appelle un humain.
 *
 * Sept passages couvrent une dizaine d'heures : bien assez pour absorber une
 * course, une coupure de base ou une indisponibilité de l'application métier.
 * Ce qui résiste après ça ne se réparera pas tout seul.
 */
const MAX_TENTATIVES = 7;

type EventRow = {
  event_id: string;
  type: string;
  reference: string | null;
  process_attempts: number;
  received_at: string;
};

/**
 * Rejoue les événements non traités dont l'heure de reprise est venue.
 *
 * Ne jette jamais : c'est un filet de rattrapage, il ne doit pas faire échouer
 * le cron qui l'héberge.
 */
export async function replayUnprocessedStripeEvents(
  limit = 10,
): Promise<{ tentes: number; traites: number }> {
  const supabase = serviceClient();
  if (!supabase) return { tentes: 0, traites: 0 };

  const maintenant = new Date().toISOString();
  const { data, error } = await supabase
    .from("stripe_events")
    .select("event_id, type, reference, process_attempts, received_at")
    .is("processed_at", null)
    .lt("process_attempts", MAX_TENTATIVES)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${maintenant}`)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (error || !data) return { tentes: 0, traites: 0 };

  let tentes = 0;
  let traites = 0;

  for (const row of data as EventRow[]) {
    tentes += 1;
    const tentatives = row.process_attempts + 1;

    /* Le compteur est posé AVANT la tentative. Si les effets tuent le processus,
       l'événement ne repartira pas en boucle infinie au prochain passage. */
    await supabase
      .from("stripe_events")
      .update({
        process_attempts: tentatives,
        next_attempt_at: new Date(
          Date.now() + prochainDelaiMinutes(tentatives) * 60_000,
        ).toISOString(),
      })
      .eq("event_id", row.event_id);

    try {
      const event = await stripe().events.retrieve(row.event_id);
      await applyStripeEvent(event, row.event_id);

      /* `applyStripeEvent` pose lui-même `processed_at` quand il a agi. On relit
         plutôt que de le supposer : certaines branches constatent qu'il n'y a
         rien à faire et laissent volontairement l'événement en attente. */
      const { data: apres } = await supabase
        .from("stripe_events")
        .select("processed_at")
        .eq("event_id", row.event_id)
        .maybeSingle();
      if ((apres as { processed_at: string | null } | null)?.processed_at) {
        traites += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("stripe_events")
        .update({ process_error: message.slice(0, 500) })
        .eq("event_id", row.event_id);
      console.error(
        `[stripe-replay] ${row.type} (${row.event_id}) tentative ${tentatives} :`,
        message.slice(0, 200),
      );
    }

    if (tentatives >= MAX_TENTATIVES) {
      /* Dernier passage : plus personne ne reprendra celui-ci. */
      await alerteStripe("Notification Stripe abandonnée après reprises", [
        `Type : ${row.type}`,
        `Événement : ${row.event_id}`,
        `Référence : ${row.reference ?? "(absente)"}`,
        `Reçue le : ${row.received_at}`,
        `Tentatives : ${tentatives}`,
        "Plus aucune reprise automatique. Selon le type : la facture n'est pas dans notre registre, ou une échéance n'a pas prolongé la période. À traiter à la main, ou à rejouer depuis le tableau de bord Stripe une fois la cause corrigée.",
      ]);
    }
  }

  return { tentes, traites };
}
