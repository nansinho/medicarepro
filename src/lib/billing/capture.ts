import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { formatEuros, type BillingPlan } from "@/lib/checkout/pricing";
import { moneticoConfigForPlan } from "@/lib/billing/monetico-routing";
import { orderContext } from "@/lib/billing/orders";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import {
  buildCaptureRequest,
  parseCaptureResponse,
  parseMoneticoDate,
  isCaptureAlreadyDone,
  type CaptureResponse,
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
  /** La banque n'a PAS été appelée : il n'y avait rien à faire, ce n'est
      donc ni un succès ni un refus, et ça ne doit jamais alerter. */
  skipped?: boolean;
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
     authentifie la commande dessus (« commande non authentifiee » sinon).
     On la lit sur LA COMMANDE qui porte cette référence, pas sur l'abonnement :
     un abonnement peut avoir changé de carte ou de formule depuis, et sa
     référence courante n'est alors plus celle de cette écriture. Résoudre par
     l'abonnement rendrait inencaissable toute échéance antérieure. */
  const ctx = await orderContext(supabase, entry.reference);

  const orderDate = orderDateOf(
    ctx?.orderDate ?? null,
    ctx?.fallbackDateIso ?? new Date().toISOString(),
  );
  if (!orderDate) {
    return {
      ok: false,
      lib: "",
      message: "Date de commande illisible : encaissement à faire depuis le CIC.",
    };
  }

  /* Signature avec la clé DU TPE qui porte la commande. En pratique seul le
     récurrent a des échéances à encaisser (l'immédiat prend l'argent d'office),
     mais se fier au plan de la commande plutôt qu'à un défaut évite un
     « commande non authentifiee » silencieux le jour où ce ne sera plus vrai. */
  /* COMMANDE D'UNE AUTRE PLATEFORME : rien à encaisser, et surtout pas
     d'alerte. Une échéance de la plateforme d'essai n'a jamais autorisé
     d'argent réel ; l'appeler en production renvoie « commande non
     authentifiee », ce qui déclenchait « URGENT — Encaissement REFUSÉ par la
     banque » et invitait à aller encaisser une somme qui n'existe pas. Le cron
     de rattrapage reprenant l'écriture à chaque passage, l'alerte se répétait
     indéfiniment et aurait fini par masquer un vrai impayé.
     `platform` à NULL veut dire « inconnue » : on encaisse comme avant. */
  const platform = ctx?.platform ?? null;
  const modeCourant = billingEnv().moneticoMode;
  if (platform && platform !== modeCourant) {
    const raison = `Commande passée sur la plateforme ${platform === "test" ? "d'essai" : "de production"} : aucun encaissement réel n'est possible, et aucun n'est dû.`;
    /* Écrit sur l'écriture pour qu'un opérateur voie POURQUOI elle reste non
       encaissée, au lieu de la croire oubliée. Aucune alerte : ce n'est pas un
       refus bancaire, c'est une écriture qui n'a jamais représenté d'argent. */
    await supabase
      .from("billing_ledger")
      .update({ capture_error: raison })
      .eq("id", entry.id);
    return { ok: false, lib: "", skipped: true, message: raison };
  }

  const config = moneticoConfigForPlan(ctx?.plan ?? "MONTHLY");

  async function attempt(alreadyCapturedCents: number): Promise<CaptureResponse> {
    const { url, fields } = buildCaptureRequest(
      {
        reference: entry.reference,
        orderDate: orderDate!,
        // Montant de la COMMANDE (le 1er paiement fait foi), pas de l'échéance.
        amountCents: ctx?.amountCents ?? entry.amount_cents,
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
    /* Refus « déjà recouvré / solde nul » : le contrat NB8179R encaisse
       automatiquement dès le renouvellement (CIC 28/07/2026). La banque a
       donc déjà pris l'argent — c'est un succès, pas un impayé. On marque
       l'échéance encaissée SANS alerter, pour ne pas noyer l'équipe sous de
       fausses alertes URGENT à chaque reconduction. */
    if (isCaptureAlreadyDone(result.lib)) {
      await supabase
        .from("billing_ledger")
        .update({ captured_at: new Date().toISOString(), capture_error: null })
        .eq("id", entry.id);
      await logAudit({
        action: "billing.capture_auto_by_bank",
        entityType: "billing_ledger",
        entityId: String(entry.id),
        diff: { reference: entry.reference, lib: result.lib },
      });
      return {
        ok: true,
        lib: result.lib,
        message: "Déjà encaissé par la banque (recouvrement automatique).",
      };
    }

    // Vrai refus (carte refusée, expirée…) : là, il faut agir.
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
  /* TPE d'origine de la commande. La signature du service de capture doit être
     faite avec la clé DU TPE qui porte la commande : un appel signé pour le
     TPE récurrent sur une commande du TPE immédiat repart en « commande non
     authentifiee ». Défaut MONTHLY : c'est le seul plan dont l'annulation
     d'autorisation a un sens (l'annuel est encaissé d'office, il se rembourse,
     il ne s'annule pas). */
  plan?: BillingPlan;
  /* Plateforme d'origine de la commande. NULL = inconnue : on appelle la banque
     comme avant. Une autorisation posée sur la plateforme d'essai n'immobilise
     rien sur la carte du client, il n'y a donc rien à libérer. */
  platform?: "test" | "production" | null;
}): Promise<CaptureOutcome> {
  const modeCourant = billingEnv().moneticoMode;
  if (input.platform && input.platform !== modeCourant) {
    return {
      ok: true,
      lib: "",
      message: `Commande de la plateforme ${input.platform === "test" ? "d'essai" : "de production"} : aucune autorisation réelle n'a été posée sur la carte.`,
    };
  }

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
    moneticoConfigForPlan(input.plan ?? "MONTHLY"),
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
