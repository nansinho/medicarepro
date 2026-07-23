import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { formatEuros } from "@/lib/checkout/pricing";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import {
  buildCaptureRequest,
  parseCaptureResponse,
  parseMoneticoDate,
  type CaptureResponse,
  type MoneticoConfig,
} from "@/lib/monetico";

/* ============================================================
   Mise en recouvrement des échéances.

   Le TPE NB8179R autorise mais n'encaisse pas : chaque échéance
   naît « Enregistré », montant restant = montant total, et attend
   une demande explicite. Sans cet automate, on facturerait et on
   provisionnerait des clients dont l'argent ne bouge jamais.

   Principe : on n'encaisse QU'APRÈS que le compte existe. Une
   autorisation non capturée expire d'elle-même — c'est donc le
   sens de sécurité qui protège le client (constaté sur le dossier
   MPVCEW73NQYD : provisioning en échec, aucun débit).
   ============================================================ */

const REQUEST_TIMEOUT_MS = 15_000;

type LedgerRow = {
  id: number;
  reference: string;
  amount_cents: number;
  currency: string;
  cabinet_name: string;
  event_type: string;
  captured_at: string | null;
};

export type CaptureOutcome = {
  ok: boolean;
  /** Libellé bancaire, vide si la banque n'a pas répondu. */
  lib: string;
  message: string;
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-capture] échec alerte :", errMessage(err));
  }
}

function moneticoConfig(): MoneticoConfig {
  const b = billingEnv();
  return {
    tpe: b.moneticoTpe,
    key: b.moneticoKey,
    societe: b.moneticoSociete,
    mode: b.moneticoMode,
  };
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

/** Date de commande figée au checkout (JJ/MM/AAAA) → instant absolu. */
function orderDateOf(raw: string | null, fallbackIso: string): Date | null {
  if (raw) return parseMoneticoDate(`${raw}:00:00:00`);
  const d = new Date(fallbackIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ------------------------------------------------------------
   Encaissement d'une échéance déjà écrite au journal comptable.
   Idempotent : une écriture déjà capturée n'est jamais rejouée.
   ------------------------------------------------------------ */

export async function captureLedgerEntry(
  ledgerId: number,
): Promise<CaptureOutcome> {
  const supabase = serviceClient();
  if (!supabase) return { ok: false, lib: "", message: "Base non configurée." };

  const { data, error } = await supabase
    .from("billing_ledger")
    .select("id, reference, amount_cents, currency, cabinet_name, event_type, captured_at")
    .eq("id", ledgerId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, lib: "", message: "Écriture comptable introuvable." };
  }
  const entry = data as LedgerRow;
  if (entry.captured_at) {
    return { ok: true, lib: "", message: "Échéance déjà encaissée." };
  }

  /* La date de commande doit être transmise à l'identique : la banque
     authentifie la commande dessus (« commande non authentifiee » sinon). */
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("monetico_order_date, started_at, first_payment_cents")
    .eq("monetico_reference", entry.reference)
    .maybeSingle();
  const sub = subData as {
    monetico_order_date: string | null;
    started_at: string;
    first_payment_cents: number;
  } | null;

  const orderDate = orderDateOf(
    sub?.monetico_order_date ?? null,
    sub?.started_at ?? new Date().toISOString(),
  );
  if (!orderDate) {
    return {
      ok: false,
      lib: "",
      message: "Date de commande illisible : encaissement à faire depuis le CIC.",
    };
  }

  const config = moneticoConfig();

  async function attempt(alreadyCapturedCents: number): Promise<CaptureResponse> {
    const { url, fields } = buildCaptureRequest(
      {
        reference: entry.reference,
        orderDate: orderDate!,
        // Montant de la COMMANDE (le 1er paiement fait foi), pas de l'échéance.
        amountCents: sub?.first_payment_cents ?? entry.amount_cents,
        captureCents: entry.amount_cents,
        alreadyCapturedCents,
        remainingCents: 0,
        currency: entry.currency,
      },
      config,
    );
    return postCapture(url, fields);
  }

  /* « montant_deja_capture doit correspondre à l'historique » : pour une
     reconduction, l'historique est la somme déjà encaissée. L'exemple de la
     doc utilise pourtant 0 — un refus ne produisant aucun effet bancaire,
     on tente l'historique puis 0 plutôt que d'abandonner un encaissement. */
  let history = 0;
  if (entry.event_type === "card_renewal") {
    const { data: past } = await supabase
      .from("billing_ledger")
      .select("amount_cents")
      .eq("reference", entry.reference)
      .not("captured_at", "is", null);
    history = (past ?? []).reduce(
      (sum, r) => sum + Number((r as { amount_cents: number }).amount_cents),
      0,
    );
  }

  let result: CaptureResponse;
  try {
    result = await attempt(history);
    if (!result.accepted && history !== 0) result = await attempt(0);
  } catch (err) {
    const message = errMessage(err);
    await supabase
      .from("billing_ledger")
      .update({ capture_error: `Banque injoignable : ${message}` })
      .eq("id", entry.id);
    await sendBillingAlert("Encaissement impossible — banque injoignable", [
      `Cabinet : ${entry.cabinet_name}`,
      `Référence : ${entry.reference} — ${formatEuros(entry.amount_cents)}`,
      `Erreur : ${message}`,
      "L'échéance est autorisée mais NON ENCAISSÉE. Elle sera retentée au prochain passage du cron.",
    ]);
    return { ok: false, lib: "", message };
  }

  if (!result.accepted) {
    await supabase
      .from("billing_ledger")
      .update({ capture_error: result.lib || "refus sans libellé" })
      .eq("id", entry.id);
    await sendBillingAlert("URGENT — Encaissement REFUSÉ par la banque", [
      `Cabinet : ${entry.cabinet_name}`,
      `Référence : ${entry.reference} — ${formatEuros(entry.amount_cents)}`,
      `Réponse de la banque : ${result.lib || "(aucun libellé)"}`,
      "Le compte est actif mais l'argent n'a pas été prélevé. Encaisser depuis le tableau de bord CIC (Gestion des paiements → fiche du paiement → Recouvrer).",
    ]);
    return { ok: false, lib: result.lib, message: `Refus : ${result.lib}` };
  }

  await supabase
    .from("billing_ledger")
    .update({ captured_at: new Date().toISOString(), capture_error: null })
    .eq("id", entry.id);

  await logAudit({
    action: "billing.capture_succeeded",
    entityType: "billing_ledger",
    entityId: String(entry.id),
    diff: { reference: entry.reference, amountCents: entry.amount_cents },
  });

  return { ok: true, lib: result.lib, message: "Échéance encaissée." };
}

/* ------------------------------------------------------------
   Annulation d'une autorisation (les trois montants à 0).
   Utilisée quand le compte ne pourra pas être créé : le client
   ne doit pas rester avec une empreinte bancaire immobilisée.
   ------------------------------------------------------------ */

export async function cancelAuthorization(input: {
  reference: string;
  orderDate: string | null;
  amountCents: number;
  currency?: string;
  cabinetName: string;
}): Promise<CaptureOutcome> {
  const orderDate = orderDateOf(input.orderDate, new Date().toISOString());
  if (!orderDate) {
    return { ok: false, lib: "", message: "Date de commande illisible." };
  }

  const { url, fields } = buildCaptureRequest(
    {
      reference: input.reference,
      orderDate,
      amountCents: input.amountCents,
      captureCents: 0,
      alreadyCapturedCents: 0,
      remainingCents: 0,
      currency: input.currency ?? "EUR",
    },
    moneticoConfig(),
  );

  let result: CaptureResponse;
  try {
    result = await postCapture(url, fields);
  } catch (err) {
    return { ok: false, lib: "", message: errMessage(err) };
  }

  if (!result.accepted) {
    await sendBillingAlert("Annulation d'autorisation refusée", [
      `Cabinet : ${input.cabinetName}`,
      `Référence : ${input.reference} — ${formatEuros(input.amountCents)}`,
      `Réponse de la banque : ${result.lib || "(aucun libellé)"}`,
      "L'autorisation reste posée sur la carte du client. Annuler depuis le tableau de bord CIC.",
    ]);
    return { ok: false, lib: result.lib, message: `Refus : ${result.lib}` };
  }

  await logAudit({
    action: "billing.authorization_canceled",
    entityType: "pending_signup",
    entityId: input.reference,
    diff: { amountCents: input.amountCents },
  });
  return { ok: true, lib: result.lib, message: "Autorisation annulée." };
}

/* ------------------------------------------------------------
   File de rattrapage : encaisse les échéances autorisées restées
   sur le carreau (banque injoignable, refus transitoire…).
   ------------------------------------------------------------ */

export async function captureDueEntries(limit = 20): Promise<number> {
  const supabase = serviceClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("billing_ledger")
    .select("id")
    .is("captured_at", null)
    .in("event_type", ["card_payment", "card_renewal"])
    .order("occurred_at", { ascending: true })
    .limit(limit);
  if (error || !data) return 0;

  let done = 0;
  for (const { id } of data as { id: number }[]) {
    try {
      const outcome = await captureLedgerEntry(id);
      if (outcome.ok) done += 1;
    } catch (err) {
      console.error("[billing-capture] échéance en erreur :", errMessage(err));
    }
  }
  return done;
}
