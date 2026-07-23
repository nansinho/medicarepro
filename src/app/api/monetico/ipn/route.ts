import { after, type NextRequest } from "next/server";
import { hasBilling, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { processDuePendingSignups } from "@/lib/billing/worker";
import { finalizeRenewal } from "@/lib/billing/renewals";
import {
  parseIpnBody,
  verifyIpnSeal,
  filterIpnForStorage,
  parseMontant,
  parseMoneticoDate,
  IPN_ACK_OK,
  IPN_ACK_KO,
} from "@/lib/monetico";

/* ============================================================
   POST /api/monetico/ipn — interface « Retour » Monetico.
   1. MAC vérifié AVANT TOUT (HMAC recalculé, temps constant) —
      invalide : cdr=1 sans mutation NI journalisation du payload.
   2. Logique métier transactionnelle via record_monetico_ipn
      (journal idempotent + transition + garde montant).
   3. Provisioning déclenché APRÈS la réponse (after()) : Monetico
      attend son acquittement en quelques secondes.
   Réponse TOUJOURS text/plain, à l'octet près (version=2\ncdr=…).

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

    // Authenticité : MAC recalculé sur tous les champs reçus (sauf MAC).
    // Invalide → cdr=1 SANS mutation ni journalisation du payload.
    if (!verifyIpnSeal(fields, billingEnv().moneticoKey)) {
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
    // 'replay' | 'refused' | 'stale' | 'ignored' | 'renew_duplicate' :
    // journalisés par la RPC, aucun effet de bord supplémentaire.

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
