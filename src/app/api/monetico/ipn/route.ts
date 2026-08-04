import { after, type NextRequest } from "next/server";
import { hasBilling, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { processDuePendingSignups } from "@/lib/billing/worker";
import { finalizeRenewal } from "@/lib/billing/renewals";
import { finalizeAnnualRenewal } from "@/lib/billing/renewal-payment";
import { finalizeOrderPayment } from "@/lib/billing/attach";
import { registerPaymentFailure } from "@/lib/billing/dunning";
import { moneticoKeyForTpe } from "@/lib/billing/monetico-routing";
import {
  parseIpnBody,
  verifyIpnSeal,
  filterIpnForStorage,
  parseMontant,
  parseMoneticoDate,
  REFUSED_CODE,
  IPN_ACK_OK,
  IPN_ACK_KO,
} from "@/lib/monetico";

/* ============================================================
   POST /api/monetico/ipn — interface « Retour » Monetico.
   1. MAC vérifié AVANT TOUT (HMAC recalculé, temps constant) —
      invalide : cdr=1 sans mutation NI journalisation du payload.
   2. Logique métier transactionnelle via record_monetico_ipn
      (journal idempotent + transition + garde montant).
   3. Aiguillage APRÈS le journal seulement (voir ci-dessous).
   4. Provisioning déclenché APRÈS la réponse (after()) : Monetico
      attend son acquittement en quelques secondes.
   Réponse TOUJOURS text/plain, à l'octet près (version=2\ncdr=…).

   ORDRE DU JOURNAL — corrigé le 04/08/2026. Le renouvellement annuel
   était aiguillé AVANT l'appel à record_monetico_ipn, donc ses
   notifications n'entraient JAMAIS dans ipn_events : ni trace, ni
   idempotence, et un refus sur ces références n'était traité nulle
   part. La RPC est désormais appelée pour TOUTE notification (elle ne
   mute rien quand la référence lui est étrangère), et l'aiguillage se
   fait ensuite, à partir de son verdict.

   RÈGLE ABSOLUE : ne JAMAIS logger le payload IPN, le MAC ni la clé.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_PLAIN = { headers: { "content-type": "text/plain" } };

function ackOk(): Response {
  return new Response(IPN_ACK_OK, TEXT_PLAIN);
}

function ackKo(): Response {
  return new Response(IPN_ACK_KO, TEXT_PLAIN);
}

/** Alerte billing interne — best-effort (jamais bloquante). */
async function sendIpnAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error(
      "[monetico-ipn] échec alerte billing :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Sans configuration billing ou base : impossible de vérifier/traiter —
    // cdr=1, Monetico re-présentera la notification.
    if (!hasBilling()) return ackKo();
    const supabase = serviceClient();
    if (!supabase) return ackKo();

    const rawBody = await request.text();
    const fields = parseIpnBody(rawBody);

    // Authenticité : MAC recalculé sur tous les champs reçus (sauf MAC),
    // avec la clé du TPE qui a émis l'IPN (récurrent NB8179R ou immédiat
    // NB8179I pour l'annuel). Invalide → cdr=1 SANS mutation ni journal.
    if (!verifyIpnSeal(fields, moneticoKeyForTpe(fields["TPE"] ?? ""))) {
      return ackKo();
    }

    const reference = fields["reference"] ?? "";
    const codeRetour = fields["code-retour"] ?? "";
    const montant = parseMontant(fields["montant"] ?? "");

    /* Le TPE récurrent renotifie CHAQUE échéance avec la même référence et
       le même code-retour : seule la date distingue deux débits. Elle sert
       donc de clé d'événement (idempotence) et d'horodatage comptable. */
    const eventDate = fields["date"] ?? "";
    const occurredAt = parseMoneticoDate(eventDate);

    /* JOURNAL D'ABORD. La RPC insère la notification dans ipn_events puis
       applique la logique du tunnel. Pour une référence qui ne lui appartient
       pas (renouvellement annuel), elle ne mute RIEN et se contente de
       répondre 'unknown_reference' ou 'stale' : l'appeler systématiquement est
       donc sans effet de bord, et c'est ce qui garantit qu'aucun paiement ne
       passe hors journal. */
    const { data, error } = await supabase.rpc("record_monetico_ipn", {
      p_reference: reference,
      p_code_retour: codeRetour,
      p_event_key: eventDate,
      p_occurred_at: occurredAt?.toISOString() ?? null,
      p_amount_cents: montant?.cents ?? null,
      p_currency: montant?.currency ?? null,
      p_raw: filterIpnForStorage(fields),
    });
    if (error) {
      // cdr=1 : Monetico re-présentera (le journal est idempotent).
      console.error("[monetico-ipn] record_monetico_ipn :", error.message);
      return ackKo();
    }

    const outcome = String(data);

    /* Commandes hors tunnel (souscription d'un cabinet existant, et plus tard
       changement de carte ou de formule). Les lignes rétro-remplies par la
       migration 0028 portent kind='initial' et sont EXCLUES : elles restent
       traitées par record_monetico_ipn, exactement comme avant. C'est la
       garantie de non-régression pour tous les abonnements existants. */
    if (codeRetour === "paiement" || codeRetour === "payetest") {
      const { data: orderRow } = await supabase
        .from("subscription_orders")
        .select("id, kind")
        .eq("monetico_reference", reference)
        .neq("kind", "initial")
        .maybeSingle();
      if (orderRow) {
        after(async () => {
          try {
            await finalizeOrderPayment({
              reference,
              occurredAt: occurredAt ?? new Date(),
              amountCents: montant?.cents ?? null,
              currency: montant?.currency ?? null,
              /* Le verdict du journal distingue une reconduction réelle
                 (événement neuf) d'une re-présentation du même débit. */
              isReplay: outcome === "replay",
            });
          } catch (err) {
            console.error(
              "[monetico-ipn] finalisation de commande :",
              err instanceof Error ? err.message : String(err),
            );
          }
        });
        return ackOk();
      }
    }

    /* Re-paiement de renouvellement annuel (self-service). Ces références sont
       étrangères au tunnel : la RPC vient donc de les journaliser puis de les
       laisser passer. Ne concerne QUE les références présentes dans
       subscription_renewals — aucun effet sur le flux d'inscription.

       Cette branche est volontairement placée AVANT la sortie sur 'replay' :
       si la finalisation avait échoué au premier passage (redémarrage pendant
       le after(), SMTP…), une re-présentation doit pouvoir la rattraper. Le
       verrou de statut 'pending/paid' → 'extended' rend l'appel idempotent,
       donc la rejouer ne prolonge jamais deux fois. */
    if (codeRetour === "paiement" || codeRetour === "payetest") {
      const { data: renewalRow } = await supabase
        .from("subscription_renewals")
        .select("id")
        .eq("monetico_reference", reference)
        .maybeSingle();
      if (renewalRow) {
        after(async () => {
          try {
            await finalizeAnnualRenewal({
              reference,
              occurredAt: occurredAt ?? new Date(),
              amountCents: montant?.cents ?? null,
              currency: montant?.currency ?? null,
            });
          } catch (err) {
            console.error(
              "[monetico-ipn] finalisation renouvellement annuel :",
              err instanceof Error ? err.message : String(err),
            );
          }
        });
        return ackOk();
      }
    }

    /* REFUS DE PAIEMENT sur une référence qui n'est pas un dossier de checkout
       en attente ('refused' couvre ce cas-là, traité par la RPC). Reste donc :
       une échéance de reconduction refusée (carte expirée, provision) ou un
       renouvellement annuel refusé. Aucun des deux n'était traité jusqu'ici :
       l'argent cessait d'entrer en silence.

       Le test sur 'stale' vaut garde d'idempotence : une re-présentation du
       même refus retourne 'replay', jamais 'stale'. Le client ne reçoit donc
       qu'un seul email par refus, et le compteur d'impayés n'est incrémenté
       qu'une fois. */
    if (codeRetour === REFUSED_CODE && outcome === "stale") {
      after(async () => {
        try {
          await registerPaymentFailure({
            reference,
            codeRetour,
            occurredAt: occurredAt ?? new Date(),
          });
        } catch (err) {
          console.error(
            "[monetico-ipn] traitement du refus :",
            err instanceof Error ? err.message : String(err),
          );
        }
      });
      return ackOk();
    }

    /* Notification déjà traitée (même référence, même code, même échéance) :
       le journal a fait son office et les deux branches rattrapables sont
       passées. Tout le reste serait un doublon. */
    if (outcome === "replay") return ackOk();

    if (outcome === "paid" || outcome === "paid_superseded") {
      // Provisioning hors du chemin de réponse : l'acquittement part
      // tout de suite, le worker tourne après (claim atomique côté DB).
      after(async () => {
        try {
          await processDuePendingSignups(3);
        } catch (err) {
          console.error(
            "[monetico-ipn] worker post-IPN :",
            err instanceof Error ? err.message : String(err),
          );
        }
      });
    } else if (outcome === "renewed" || outcome === "renewed_amount_mismatch") {
      // Échéance de reconduction : la période et l'écriture comptable sont
      // déjà posées par la RPC ; restent la facture et le reçu client.
      const mismatch = outcome === "renewed_amount_mismatch";
      after(async () => {
        try {
          await finalizeRenewal({
            reference,
            occurredAt: occurredAt ?? new Date(),
            amountCents: montant?.cents ?? null,
            amountMismatch: mismatch,
          });
        } catch (err) {
          console.error(
            "[monetico-ipn] finalisation du renouvellement :",
            err instanceof Error ? err.message : String(err),
          );
        }
      });
    } else if (outcome === "amount_mismatch") {
      after(() =>
        sendIpnAlert("URGENT — Montant IPN inattendu (amount_mismatch)", [
          `Référence : ${reference}`,
          `Code retour : ${codeRetour}`,
          `Montant reçu : ${fields["montant"] ?? "(absent)"}`,
          "Le dossier est bloqué en amount_mismatch — il ne sera JAMAIS provisionné automatiquement. Vérifier l'encaissement et rembourser si nécessaire via le CIC.",
        ]),
      );
    } else if (outcome === "unknown_reference") {
      after(() =>
        sendIpnAlert("IPN Monetico sur référence inconnue", [
          `Référence : ${reference}`,
          `Code retour : ${codeRetour}`,
          `Montant reçu : ${fields["montant"] ?? "(absent)"}`,
          "Aucun dossier ne correspond — vérifier le TPE et l'origine du paiement.",
        ]),
      );
    }
    /* 'refused'        refus sur un dossier de checkout en attente : le client
                        l'a vu sur sa page de retour, il peut relancer.
       'stale' (hors refus), 'ignored', 'renew_duplicate' : journalisés par la
                        RPC, aucun effet de bord supplémentaire. */

    return ackOk();
  } catch (err) {
    // Jamais de payload dans les logs — message court uniquement.
    console.error(
      "[monetico-ipn] erreur :",
      err instanceof Error ? err.message : String(err),
    );
    return ackKo();
  }
}
