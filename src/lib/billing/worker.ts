import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import {
  provisionCabinet,
  ProvisioningConflictError,
  ProvisioningRequestError,
  ProvisioningUnavailableError,
  type ProvisionPayload,
  type ProvisionResult,
} from "@/lib/provisioning";
import {
  renewalAmountCents,
  formatEuros,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import {
  paymentReceiptEmail,
  provisioningIncidentEmailClient,
  billingAlertEmail,
  sepaMandateCopyEmail,
} from "@/lib/emails/checkout-templates";
import { mandateText } from "@/lib/sepa/mandate-text";
import { maskIban, ibanLast4 } from "@/lib/sepa/iban";
import { buildMandatePdf } from "@/lib/sepa/mandate-pdf";
import { issueInvoice } from "@/lib/billing/invoices";

/* ============================================================
   Worker de provisioning — cœur du tunnel d'inscription payante.

   Un dossier pending_signups passe 'paid' → 'provisioning' (claim
   atomique, exclusif) → 'provisioned' quand le compte est créé
   dans l'app (contrat dev B). Chaque transition d'erreur est
   typée : conflit 409 (manuel, jamais rejoué), 400/401 (manuel),
   indisponible (retry avec backoff exponentiel plafonné).

   RÈGLE ABSOLUE : ne JAMAIS logger mot de passe, IBAN, payloads —
   les erreurs ne portent que des messages courts.
   ============================================================ */

/** Un claim 'provisioning' plus vieux que ça est considéré mort (crash). */
const DEAD_CLAIM_MINUTES = 10;
/** Plafond du backoff exponentiel entre deux tentatives (minutes). */
const MAX_BACKOFF_MINUTES = 60;
/** Au-delà de ce nombre de tentatives, on alerte l'équipe billing. */
const ALERT_AFTER_ATTEMPTS = 8;

/* ------------------------------------------------------------
   Types des colonnes lues (jsonb du contrat dev B inclus).
   ------------------------------------------------------------ */

type ContractCabinet = {
  name: string;
  email: string;
  phone: string;
  mobilePhone: string;
  address: string;
  city: string;
  postalCode: string;
  siretNumber?: string;
  rppsNumber: string;
};

type ContractUser = { firstName: string; lastName: string; email: string };

type SepaPayload = {
  iban: string;
  bic?: string;
  accountHolder: string;
  consentAt?: string;
};

type PendingSignupRow = {
  id: string;
  root_id: string;
  monetico_reference: string;
  status: string;
  plan: BillingPlan;
  extra_collaborators: number;
  amount_cents: number;
  currency: string;
  cabinet: ContractCabinet;
  user_info: ContractUser;
  invoice_prefix: string;
  password_enc: string | null;
  sepa_payload_enc: string | null;
  reserved_rum: string | null;
  mandate_text_version: string;
  mandate_text_sha256: string;
  mandate_accepted_at: string;
  client_ip: string | null;
  user_agent: string | null;
  paid_at: string | null;
  provision_attempts: number;
  next_retry_at: string | null;
};

/* ------------------------------------------------------------
   Petits utilitaires (aucune donnée sensible ne transite ici).
   ------------------------------------------------------------ */

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** "11 juillet 2026 à 14:32" — horodatage lisible (heure de Paris). */
function frDateTime(iso: string | null): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(iso ? new Date(iso) : new Date());
}

/** Adresse complète du cabinet — MÊME format qu'au checkout (sceau du mandat). */
function fullAddress(cabinet: ContractCabinet): string {
  return `${cabinet.address}, ${cabinet.postalCode} ${cabinet.city}`;
}

/** Libellé humain de l'offre pour les emails/factures. */
function planLabel(plan: BillingPlan, extraCollaborators: number): string {
  const base =
    plan === "ANNUAL" ? "Offre 12 mois" : "Offre mensuelle sans engagement";
  if (extraCollaborators === 0) return base;
  return `${base} + ${extraCollaborators} collaborateur${extraCollaborators > 1 ? "s" : ""}`;
}

/** date + N mois, jour du mois borné (31 janv. + 1 mois = 28/29 févr.). */
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Alerte billing interne — best-effort, ne jette jamais. */
async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-worker] échec alerte billing :", errMessage(err));
  }
}

/* ------------------------------------------------------------
   Garde de chaîne : un 2e paiement d'une même chaîne (root_id)
   déjà provisionnée = double encaissement → remboursement manuel.
   ------------------------------------------------------------ */

async function markDuplicatePaid(
  supabase: SupabaseClient,
  row: PendingSignupRow,
): Promise<void> {
  const { data } = await supabase
    .from("pending_signups")
    .update({
      status: "duplicate_paid",
      last_error:
        "Double encaissement : un autre dossier de la chaîne est déjà provisionné ou en cours.",
    })
    .eq("id", row.id)
    .eq("status", "paid")
    .select("id");
  if (!data || data.length === 0) return; // course perdue : déjà traité ailleurs

  await sendBillingAlert("URGENT — Double encaissement détecté", [
    `Le dossier ${row.id} (référence ${row.monetico_reference}) a été payé alors qu'un autre dossier de la même chaîne est déjà provisionné ou en cours de provisioning.`,
    `Cabinet : ${row.cabinet.name}`,
    `Montant encaissé : ${formatEuros(row.amount_cents)}`,
    "Action : rembourser CE paiement depuis le tableau de bord CIC/Monetico — aucun provisioning automatique ne sera tenté.",
  ]);

  await logAudit({
    action: "provisioning.duplicate_paid",
    entityType: "pending_signup",
    entityId: row.id,
    diff: { reference: row.monetico_reference },
  });
}

/* ------------------------------------------------------------
   Sorties d'erreur du provisioning.
   ------------------------------------------------------------ */

/** Erreur non rejouable automatiquement : retour 'paid' SANS next_retry_at. */
async function failManual(
  supabase: SupabaseClient,
  row: PendingSignupRow,
  lastError: string,
): Promise<void> {
  await supabase
    .from("pending_signups")
    .update({ status: "paid", next_retry_at: null, last_error: lastError })
    .eq("id", row.id)
    .eq("status", "provisioning");

  await sendBillingAlert("URGENT — Provisioning en échec (intervention requise)", [
    `Dossier ${row.id} (référence ${row.monetico_reference}) — cabinet ${row.cabinet.name}.`,
    `Montant encaissé : ${formatEuros(row.amount_cents)}.`,
    `Erreur : ${lastError}`,
    "Aucune re-tentative automatique ne sera faite : diagnostiquer puis relancer manuellement.",
  ]);
}

async function handleProvisionError(
  supabase: SupabaseClient,
  row: PendingSignupRow,
  attempts: number,
  err: unknown,
): Promise<void> {
  // 409 : identifiant déjà pris APRÈS encaissement — manuel, JAMAIS rejoué.
  if (err instanceof ProvisioningConflictError) {
    await supabase
      .from("pending_signups")
      .update({
        status: "failed_conflict",
        next_retry_at: null,
        last_error: `Conflit provisioning (409) : ${errMessage(err)}`,
      })
      .eq("id", row.id)
      .eq("status", "provisioning");

    await sendBillingAlert(
      "URGENT — Conflit de provisioning après encaissement",
      [
        `Dossier ${row.id} (référence ${row.monetico_reference}) — cabinet ${row.cabinet.name}.`,
        `Montant encaissé : ${formatEuros(row.amount_cents)}.`,
        `Conflit : ${errMessage(err)}`,
        "Le compte n'a PAS été créé. Résolution manuelle obligatoire (remboursement ou création assistée) — ce dossier ne sera jamais rejoué automatiquement.",
      ],
    );

    try {
      const mail = provisioningIncidentEmailClient({
        adminFirstName: row.user_info.firstName,
      });
      await sendMail({ to: row.user_info.email, ...mail });
    } catch (mailErr) {
      console.error(
        "[billing-worker] échec email incident client :",
        errMessage(mailErr),
      );
    }

    await logAudit({
      action: "provisioning.conflict",
      entityType: "pending_signup",
      entityId: row.id,
      diff: { reference: row.monetico_reference },
    });
    return;
  }

  // 400/401 : bug d'intégration ou clé refusée — pas de retry automatique.
  if (err instanceof ProvisioningRequestError) {
    await failManual(
      supabase,
      row,
      `Requête provisioning refusée (HTTP ${err.status}) : ${errMessage(err)}`,
    );
    return;
  }

  // Indisponible (réseau/5xx) : re-tentative planifiée, backoff exponentiel.
  if (err instanceof ProvisioningUnavailableError) {
    const delayMinutes = Math.min(2 ** attempts, MAX_BACKOFF_MINUTES);
    await supabase
      .from("pending_signups")
      .update({
        status: "paid",
        next_retry_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: errMessage(err),
      })
      .eq("id", row.id)
      .eq("status", "provisioning");

    if (attempts > ALERT_AFTER_ATTEMPTS) {
      await sendBillingAlert("Provisioning toujours indisponible", [
        `Dossier ${row.id} (référence ${row.monetico_reference}) — cabinet ${row.cabinet.name}.`,
        `${attempts} tentatives sans succès (${errMessage(err)}).`,
        `Prochaine tentative dans ${delayMinutes} min. Vérifier l'API de provisioning de l'app.`,
      ]);
    }
    return;
  }

  // Inattendu (déchiffrement, base…) : traité comme manuel.
  await failManual(supabase, row, `Erreur interne worker : ${errMessage(err)}`);
}

/* ------------------------------------------------------------
   Succès du provisioning : registre local + best-effort
   (facture, emails, PDF mandat) + effacement des secrets.
   ------------------------------------------------------------ */

async function finalizeSuccess(
  supabase: SupabaseClient,
  row: PendingSignupRow,
  provision: ProvisionResult,
): Promise<void> {
  const cabinet = row.cabinet;
  const user = row.user_info;
  const rum = row.reserved_rum as string; // vérifié avant l'appel

  let subscriptionId: string | null = null;
  let sepaPayload: SepaPayload | null = null;
  let mandateCreated = false;
  let criticalOk = false;

  /* --- Section critique : registre local (subscriptions, mandat, ledger).
     Si elle échoue APRÈS un provisioning réussi, le compte app existe :
     status='provisioned' reste, last_error renseigné, rattrapage manuel. */
  try {
    // 1. Dossier → provisioned.
    const { error: e1 } = await supabase
      .from("pending_signups")
      .update({
        status: "provisioned",
        provisioned_at: new Date().toISOString(),
        app_cabinet_id: provision.cabinetId,
        app_user_id: provision.userId,
        login_url: provision.loginUrl,
        last_error: null,
      })
      .eq("id", row.id);
    if (e1) throw new Error(`pending_signups → provisioned : ${e1.message}`);

    // 2. Souscription (registre durable de facturation).
    const startedAt = new Date();
    const periodEnd = addMonthsClamped(startedAt, row.plan === "ANNUAL" ? 12 : 1);
    const { data: sub, error: e2 } = await supabase
      .from("subscriptions")
      .insert({
        pending_signup_id: row.id,
        app_cabinet_id: provision.cabinetId,
        app_user_id: provision.userId,
        cabinet_name: cabinet.name,
        cabinet_email: cabinet.email,
        admin_email: user.email,
        admin_name: `${user.firstName} ${user.lastName}`,
        invoice_prefix: row.invoice_prefix,
        plan: row.plan,
        extra_collaborators: row.extra_collaborators,
        first_payment_cents: row.amount_cents,
        renewal_amount_cents: renewalAmountCents(row.plan, row.extra_collaborators),
        currency: row.currency,
        status: "active",
        started_at: startedAt.toISOString(),
        current_period_end: periodEnd.toISOString(),
        monetico_reference: row.monetico_reference,
      })
      .select("id")
      .single();
    if (e2 || !sub) {
      throw new Error(`insert subscriptions : ${e2?.message ?? "aucune ligne"}`);
    }
    subscriptionId = sub.id as string;

    // 3. Mandat SEPA « signed » (dossier de preuve du consentement checkout).
    //    L'IBAN est RE-chiffré avec le RUM comme AAD (contrat crypto).
    sepaPayload = JSON.parse(
      decryptSecret(row.sepa_payload_enc as string, row.monetico_reference),
    ) as SepaPayload;

    const { data: mandate, error: e3 } = await supabase
      .from("sepa_mandates")
      .insert({
        rum,
        subscription_id: subscriptionId,
        status: "signed",
        scheme: "CORE",
        account_holder: sepaPayload.accountHolder,
        debtor_name: cabinet.name,
        debtor_email: user.email,
        debtor_address: fullAddress(cabinet),
        iban_encrypted: encryptSecret(sepaPayload.iban, rum),
        iban_last4: ibanLast4(sepaPayload.iban),
        bic: sepaPayload.bic ?? null,
        mandate_text_version: row.mandate_text_version,
        mandate_text_sha256: row.mandate_text_sha256,
        signed_at: row.mandate_accepted_at,
        signature_method: "checkbox",
        signature_ip: row.client_ip,
        signature_user_agent: row.user_agent,
      })
      .select("id")
      .single();
    if (e3 || !mandate) {
      throw new Error(`insert sepa_mandates : ${e3?.message ?? "aucune ligne"}`);
    }
    mandateCreated = true;

    await supabase
      .from("subscriptions")
      .update({ sepa_mandate_id: mandate.id as string })
      .eq("id", subscriptionId);

    // 4. Pièce comptable (append-only, survit à toutes les purges).
    const { error: e4 } = await supabase.from("billing_ledger").insert({
      event_type: "card_payment",
      amount_cents: row.amount_cents,
      currency: row.currency,
      occurred_at: row.paid_at ?? new Date().toISOString(),
      reference: row.monetico_reference,
      subscription_id: subscriptionId,
      cabinet_name: cabinet.name,
    });
    if (e4) throw new Error(`insert billing_ledger : ${e4.message}`);

    criticalOk = true;
  } catch (err) {
    const message = errMessage(err);
    await supabase
      .from("pending_signups")
      .update({ last_error: `Post-provisioning incomplet : ${message}` })
      .eq("id", row.id);

    await sendBillingAlert(
      "URGENT — Registre billing incomplet après provisioning",
      [
        `Dossier ${row.id} (référence ${row.monetico_reference}) — cabinet ${cabinet.name}.`,
        `Le compte app EXISTE (cabinet ${provision.cabinetId}), mais le registre local est incomplet : ${message}`,
        "Rattrapage manuel requis (souscription/mandat/ledger).",
      ],
    );

    await logAudit({
      action: "provisioning.post_failure",
      entityType: "pending_signup",
      entityId: row.id,
      diff: { reference: row.monetico_reference },
    });
  }

  /* --- Best-effort (chaque étape isolée : un échec ne bloque pas la suite). */
  if (criticalOk && subscriptionId && sepaPayload) {
    const label = planLabel(row.plan, row.extra_collaborators);
    let invoiceNumber: string | undefined;

    // Facture du 1er paiement carte.
    try {
      const invoice = await issueInvoice({
        kind: "card_first",
        amountCents: row.amount_cents,
        currency: row.currency,
        subscriptionId,
        pendingSignupId: row.id,
        cabinetName: cabinet.name,
        cabinetAddress: cabinet.address,
        cabinetPostalCity: `${cabinet.postalCode} ${cabinet.city}`,
        planLabel: label,
        reference: row.monetico_reference,
      });
      invoiceNumber = invoice.number;
    } catch (err) {
      console.error("[billing-worker] échec facture card_first :", errMessage(err));
    }

    // Reçu de paiement au client.
    // TODO : sendMail ne gère pas les pièces jointes — le PDF de facture
    // n'est PAS joint ; le template mentionne que la facture est disponible
    // sur demande / sera envoyée. À brancher quand sendMail saura joindre.
    try {
      const receipt = paymentReceiptEmail({
        adminFirstName: user.firstName,
        cabinetName: cabinet.name,
        planLabel: label,
        amountLabel: formatEuros(row.amount_cents),
        reference: row.monetico_reference,
        paidAtLabel: frDateTime(row.paid_at),
        invoiceNumber,
      });
      await sendMail({ to: user.email, ...receipt });
    } catch (err) {
      console.error("[billing-worker] échec email reçu :", errMessage(err));
    }

    // PDF du mandat → bucket privé 'sepa' + empreinte sur la ligne.
    try {
      const ibanMasked = maskIban(sepaPayload.iban);
      const text = mandateText({
        rum,
        ics: billingEnv().sepaIcs,
        debtorName: cabinet.name,
        accountHolder: sepaPayload.accountHolder,
        debtorAddress: fullAddress(cabinet),
        ibanMasked,
      });
      const pdf = await buildMandatePdf({
        rum,
        ics: billingEnv().sepaIcs,
        scheme: "CORE",
        debtorName: cabinet.name,
        accountHolder: sepaPayload.accountHolder,
        debtorAddress: fullAddress(cabinet),
        debtorEmail: user.email,
        ibanMasked,
        signedAtLabel: frDateTime(row.mandate_accepted_at),
        signatureIp: row.client_ip ?? "",
        signatureMethod: "Case à cocher en ligne (tunnel d'inscription)",
        mandateText: text,
      });
      const path = `mandates/${rum}/mandat.pdf`;
      const { error: upErr } = await supabase.storage
        .from("sepa")
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(upErr.message);
      await supabase
        .from("sepa_mandates")
        .update({ pdf_path: path, pdf_sha256: sha256Hex(pdf) })
        .eq("rum", rum);
    } catch (err) {
      console.error("[billing-worker] échec PDF mandat :", errMessage(err));
    }

    // Copie du mandat au client (obligation SEPA Core).
    try {
      const copy = sepaMandateCopyEmail({
        adminFirstName: user.firstName,
        cabinetName: cabinet.name,
        rum,
        ibanMasked: maskIban(sepaPayload.iban),
      });
      await sendMail({ to: user.email, ...copy });
    } catch (err) {
      console.error("[billing-worker] échec email copie mandat :", errMessage(err));
    }

    // Alerte interne : nouvelle souscription.
    await sendBillingAlert("Nouvelle souscription MediCare Pro", [
      `Cabinet : ${cabinet.name}`,
      `Offre : ${label}`,
      `1er paiement : ${formatEuros(row.amount_cents)} (référence ${row.monetico_reference})`,
      `Renouvellement : ${formatEuros(renewalAmountCents(row.plan, row.extra_collaborators))}`,
      `Mandat SEPA : ${rum}`,
    ]);

    await logAudit({
      action: "provisioning.succeeded",
      entityType: "pending_signup",
      entityId: row.id,
      diff: { reference: row.monetico_reference, subscriptionId },
    });
  }

  /* --- Effacement des secrets — OBLIGATOIRE, hors best-effort.
     password : le compte app existe, plus jamais besoin → toujours effacé.
     sepa : effacé seulement une fois l'IBAN re-chiffré dans sepa_mandates
     (AAD = RUM) ; sinon conservé pour le rattrapage manuel (signalé par
     l'alerte ci-dessus), purgé de toute façon par le cron à 90 jours. */
  const erase: Record<string, null> = { password_enc: null };
  if (mandateCreated) erase.sepa_payload_enc = null;
  const { error: eraseError } = await supabase
    .from("pending_signups")
    .update(erase)
    .eq("id", row.id);
  if (eraseError) {
    console.error(
      "[billing-worker] ÉCHEC effacement des secrets :",
      eraseError.message,
    );
    await sendBillingAlert("URGENT — Effacement des secrets en échec", [
      `Dossier ${row.id} (référence ${row.monetico_reference}) : les secrets chiffrés n'ont pas pu être effacés.`,
      "Effacer manuellement password_enc/sepa_payload_enc.",
    ]);
  }
}

/* ------------------------------------------------------------
   provisionPendingSignup — traite UN dossier payé (claim exclusif).
   ------------------------------------------------------------ */

export async function provisionPendingSignup(
  pendingSignupId: string,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return; // base non configurée : rien à faire

  // 0. Charge le dossier.
  const { data: rowData, error: loadError } = await supabase
    .from("pending_signups")
    .select("*")
    .eq("id", pendingSignupId)
    .maybeSingle();
  if (loadError || !rowData) return;
  const row = rowData as PendingSignupRow;
  if (row.status !== "paid") return; // déjà traité / pas prêt

  // 1. Garde de chaîne : un autre dossier de la même chaîne déjà
  //    provisionné (ou en cours) = double encaissement.
  const { data: siblings, error: siblingError } = await supabase
    .from("pending_signups")
    .select("id")
    .eq("root_id", row.root_id)
    .neq("id", row.id)
    .in("status", ["provisioning", "provisioned"])
    .limit(1);
  if (siblingError) return; // prudence : on retentera au prochain passage
  if (siblings && siblings.length > 0) {
    await markDuplicatePaid(supabase, row);
    return;
  }

  // 2. CLAIM ATOMIQUE : paid → provisioning (une seule exécution gagne).
  const { data: claimed, error: claimError } = await supabase
    .from("pending_signups")
    .update({
      status: "provisioning",
      provision_attempts: row.provision_attempts + 1,
    })
    .eq("id", row.id)
    .eq("status", "paid")
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .select("id");
  if (claimError || !claimed || claimed.length !== 1) return; // pris ailleurs / pas dû

  const attempts = row.provision_attempts + 1;

  // 3. Intégrité du dossier avant appel.
  if (!row.password_enc || !row.sepa_payload_enc || !row.reserved_rum) {
    await failManual(
      supabase,
      row,
      "Dossier incomplet (secrets ou RUM manquants) — reprise manuelle requise.",
    );
    return;
  }

  let password: string;
  try {
    password = decryptSecret(row.password_enc, row.monetico_reference);
  } catch {
    await failManual(
      supabase,
      row,
      "Déchiffrement du dossier impossible (clé/AAD) — reprise manuelle requise.",
    );
    return;
  }

  const payload: ProvisionPayload = {
    idempotencyKey: row.monetico_reference,
    cabinet: {
      name: row.cabinet.name,
      email: row.cabinet.email,
      phone: row.cabinet.phone,
      mobilePhone: row.cabinet.mobilePhone,
      address: row.cabinet.address,
      city: row.cabinet.city,
      postalCode: row.cabinet.postalCode,
      siretNumber: row.cabinet.siretNumber,
      rppsNumber: row.cabinet.rppsNumber,
      invoicePrefix: row.invoice_prefix,
    },
    user: {
      firstName: row.user_info.firstName,
      lastName: row.user_info.lastName,
      email: row.user_info.email,
      password,
    },
    plan: row.plan,
    extraCollaborators: row.extra_collaborators,
    payment: {
      provider: "MONETICO",
      reference: row.monetico_reference,
      amount: row.amount_cents,
      currency: row.currency,
      paidAt: new Date(row.paid_at ?? Date.now()).toISOString(),
    },
  };

  // 4. Appel de l'API de provisioning (retry ×3 intégré côté client HTTP).
  let provision: ProvisionResult;
  try {
    provision = await provisionCabinet(payload);
  } catch (err) {
    await handleProvisionError(supabase, row, attempts, err);
    return;
  }

  // 5. Succès : registre local + best-effort + effacement des secrets.
  await finalizeSuccess(supabase, row, provision);
}

/* ------------------------------------------------------------
   processDuePendingSignups — file du cron / de l'IPN.
   Récupère d'abord les claims morts (worker interrompu), puis
   traite séquentiellement les dossiers dus. Retourne le nombre
   de dossiers traités (tentés).
   ------------------------------------------------------------ */

export async function processDuePendingSignups(limit = 10): Promise<number> {
  const supabase = serviceClient();
  if (!supabase) return 0;

  const nowIso = new Date().toISOString();
  const staleIso = new Date(
    Date.now() - DEAD_CLAIM_MINUTES * 60_000,
  ).toISOString();

  // Récupération des claims morts : provisioning figé depuis > 10 min.
  const { error: reclaimError } = await supabase
    .from("pending_signups")
    .update({ status: "paid", next_retry_at: nowIso })
    .eq("status", "provisioning")
    .lt("updated_at", staleIso);
  if (reclaimError) {
    console.error(
      "[billing-worker] récupération des claims morts :",
      reclaimError.message,
    );
  }

  const { data, error } = await supabase
    .from("pending_signups")
    .select("id")
    .eq("status", "paid")
    .lte("next_retry_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) return 0;

  let processed = 0;
  for (const { id } of data as { id: string }[]) {
    try {
      await provisionPendingSignup(id);
      processed += 1;
    } catch (err) {
      // Jamais de payload dans les logs — message court uniquement.
      console.error("[billing-worker] dossier en erreur :", errMessage(err));
    }
  }
  return processed;
}
