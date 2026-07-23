import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { formatEuros } from "@/lib/checkout/pricing";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import {
  buildStopRecurrenceRequest,
  parseCaptureResponse,
  parseMoneticoDate,
  type CaptureResponse,
} from "@/lib/monetico";

/* ============================================================
   Arrêt de la reconduction automatique d'un abonnement.

   Monetico n'expose pas de service dédié : on appelle le service
   de capture avec stoprecurrence=OUI (cf. src/lib/monetico.ts).
   En cas de succès, « la commande ne sera plus renouvelée ».

   Enjeu : un échec silencieux = un client résilié qu'on continue
   de prélever. On ne marque donc l'abonnement résilié QUE sur un
   accusé bancaire positif (cdr=1), et tout refus part en alerte
   avec le libellé exact renvoyé par la banque.
   ============================================================ */

/** Au-delà, on considère la banque injoignable (l'appelant réessaiera). */
const REQUEST_TIMEOUT_MS = 15_000;

type SubscriptionRow = {
  id: string;
  cabinet_name: string;
  status: string;
  currency: string;
  first_payment_cents: number;
  monetico_reference: string;
  monetico_order_date: string | null;
  started_at: string;
  recurrence_stopped_at: string | null;
};

export type StopRecurrenceOutcome = {
  ok: boolean;
  /** Libellé bancaire (« recurrence stoppee », « commande non authentifiee »…). */
  lib: string;
  /** Message prêt à afficher dans l'admin. */
  message: string;
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** Alerte billing interne — best-effort, ne jette jamais. */
async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-recurrence] échec alerte :", errMessage(err));
  }
}

/** POST scellé vers le service de capture, réponse parsée. */
async function postCapture(
  url: string,
  fields: Record<string, string>,
): Promise<CaptureResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Service de capture indisponible (HTTP ${response.status}).`);
  }
  return parseCaptureResponse(await response.text());
}

/**
 * Demande à Monetico de ne plus reconduire l'abonnement, puis marque la
 * souscription résiliée UNIQUEMENT si la banque a accusé positivement.
 * Ne jette jamais : renvoie un résultat exploitable par l'admin.
 */
export async function stopRecurrence(
  subscriptionId: string,
): Promise<StopRecurrenceOutcome> {
  const supabase = serviceClient();
  if (!supabase) {
    return { ok: false, lib: "", message: "Base non configurée." };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, cabinet_name, status, currency, first_payment_cents, monetico_reference, monetico_order_date, started_at, recurrence_stopped_at",
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, lib: "", message: "Abonnement introuvable." };
  }
  const sub = data as SubscriptionRow;

  if (sub.recurrence_stopped_at) {
    return {
      ok: true,
      lib: "",
      message: "La reconduction était déjà arrêtée pour cet abonnement.",
    };
  }

  /* Date de la commande initiale — exigée à l'identique par la banque.
     Repli sur started_at si le dossier est antérieur à la migration 0022. */
  const orderDate = sub.monetico_order_date
    ? parseMoneticoDate(`${sub.monetico_order_date}:00:00:00`)
    : new Date(sub.started_at);
  if (!orderDate) {
    return {
      ok: false,
      lib: "",
      message:
        "Date de commande illisible : arrêt de récurrence à faire depuis le tableau de bord CIC.",
    };
  }

  /* « montant_deja_capture doit correspondre à l'historique de la commande » :
     on somme ce que la banque nous a effectivement versé sur cette référence.
     ⚠️ L'exemple de la doc utilise pourtant 0EUR sur une commande de 100 € —
     l'ambiguïté n'est pas levée. D'où la seconde tentative à 0 plus bas : un
     refus ne produit AUCUN effet bancaire, réessayer est sans risque, tandis
     qu'un abandon laisserait un client résilié se faire prélever. */
  const { data: ledger } = await supabase
    .from("billing_ledger")
    .select("amount_cents")
    .eq("reference", sub.monetico_reference)
    .in("event_type", ["card_payment", "card_renewal"]);
  const capturedCents = (ledger ?? []).reduce(
    (sum, row) => sum + Number((row as { amount_cents: number }).amount_cents),
    0,
  );

  const billing = billingEnv();
  const config = {
    tpe: billing.moneticoTpe,
    key: billing.moneticoKey,
    societe: billing.moneticoSociete,
    mode: billing.moneticoMode,
  };

  const attempt = async (alreadyCapturedCents: number) => {
    const { url, fields } = buildStopRecurrenceRequest(
      {
        reference: sub.monetico_reference,
        orderDate,
        amountCents: sub.first_payment_cents,
        alreadyCapturedCents,
        currency: sub.currency,
      },
      config,
    );
    return postCapture(url, fields);
  };

  let result: CaptureResponse;
  try {
    result = await attempt(capturedCents);
    if (!result.accepted && capturedCents !== 0) {
      result = await attempt(0);
    }
  } catch (err) {
    const message = errMessage(err);
    await sendBillingAlert("Arrêt de récurrence : banque injoignable", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${sub.monetico_reference}`,
      `Erreur : ${message}`,
      "La reconduction est TOUJOURS ACTIVE. Réessayer, ou arrêter l'abonnement depuis le tableau de bord CIC.",
    ]);
    return {
      ok: false,
      lib: "",
      message: `Monetico injoignable : ${message} — la reconduction reste active.`,
    };
  }

  if (!result.accepted) {
    await sendBillingAlert("URGENT — Arrêt de récurrence REFUSÉ", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${sub.monetico_reference}`,
      `Réponse de la banque : ${result.lib || "(aucun libellé)"}`,
      `Montant de la commande : ${formatEuros(sub.first_payment_cents)} — déjà capturé déclaré : ${formatEuros(capturedCents)}`,
      "La reconduction est TOUJOURS ACTIVE : le client sera prélevé à la prochaine échéance. Arrêter l'abonnement depuis le tableau de bord CIC.",
    ]);
    return {
      ok: false,
      lib: result.lib,
      message: `Refus de Monetico : ${result.lib || "sans libellé"} — la reconduction reste active.`,
    };
  }

  const stoppedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({ recurrence_stopped_at: stoppedAt, status: "canceled" })
    .eq("id", sub.id);
  if (updateError) {
    await sendBillingAlert("Récurrence arrêtée mais registre non mis à jour", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${sub.monetico_reference}`,
      `Erreur : ${updateError.message}`,
      "La banque a bien accusé l'arrêt : corriger la souscription à la main (recurrence_stopped_at, status).",
    ]);
  }

  await logAudit({
    action: "billing.recurrence_stopped",
    entityType: "subscription",
    entityId: sub.id,
    diff: { reference: sub.monetico_reference, lib: result.lib },
  });

  return {
    ok: true,
    lib: result.lib,
    message:
      "Reconduction arrêtée : la banque ne renouvellera plus cet abonnement. L'accès reste ouvert jusqu'au terme de la période déjà réglée.",
  };
}
