import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { issueInvoice } from "@/lib/billing/invoices";
import { captureLedgerEntry } from "@/lib/billing/capture";
import { finalizeRenewal } from "@/lib/billing/renewals";
import {
  claimOrderPaid,
  markOrderApplied,
  type OrderKind,
} from "@/lib/billing/orders";
import { activeChange, fulfillChange } from "@/lib/billing/changes";
import { notifyRenewal } from "@/lib/provisioning";
import {
  formatEuros,
  planLabel,
  renewalAmountCents,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import {
  paymentReceiptEmail,
  billingAlertEmail,
} from "@/lib/emails/checkout-templates";

/* ============================================================
   Souscription d'un cabinet EXISTANT (commande `attach`).

   CE QUI DISTINGUE CE CHEMIN DU TUNNEL : il n'y a AUCUN provisioning. Le
   cabinet travaille déjà dans l'application, son compte, ses utilisateurs et
   ses dossiers existent. On ne crée que le contrat de facturation. Le tunnel,
   lui, appelle toujours provisionCabinet — qui répond 409 sur un cabinet
   connu, APRÈS encaissement : c'est exactement le mur contre lequel se
   heurtait un cabinet gratuit voulant payer.

   Ordre des opérations, du plus engageant au moins engageant :
     1. verrou d'idempotence sur la commande ;
     2. contrat + pièce comptable (l'argent est entré, il doit exister) ;
     3. encaissement effectif si le TPE n'a fait qu'autoriser ;
     4. facture, reçu, remontée à l'application — chacun isolé, un échec
        n'annule jamais ce qui précède.
   ============================================================ */

type OrderRow = {
  id: string;
  subscription_id: string | null;
  app_cabinet_id: string;
  app_user_id: string | null;
  kind: OrderKind | null;
  plan: BillingPlan;
  role: "recurring" | "oneshot";
  extra_collaborators: number;
  amount_cents: number;
  currency: string;
  status: string;
  monetico_reference: string;
  monetico_order_date: string | null;
  applied_at: string | null;
  billing_snapshot: {
    cabinetName?: string;
    cabinetAddress?: string;
    cabinetPostalCity?: string;
    adminEmail?: string;
    adminName?: string;
    invoicePrefix?: string;
  };
};

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

function frDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

function frDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-attach] échec alerte :", errMessage(err));
  }
}

/** date + N mois, jour du mois borné (même règle que le worker). */
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

const ORDER_COLUMNS =
  "id, subscription_id, app_cabinet_id, app_user_id, kind, plan, role, extra_collaborators, amount_cents, currency, status, monetico_reference, monetico_order_date, applied_at, billing_snapshot";

/**
 * Point d'entrée unique des paiements portant sur une commande hors tunnel.
 *
 * UNE MÊME RÉFÉRENCE SERT PLUSIEURS FOIS : le TPE récurrent rejoue chaque
 * échéance avec la référence de la commande. Il faut donc distinguer le
 * premier paiement (qui crée le contrat) des reconductions (qui le
 * prolongent) — sinon les échéances 2, 3, 4… seraient encaissées par la
 * banque et resteraient invisibles ici, exactement le défaut que la
 * migration 0021 avait corrigé pour le tunnel.
 *
 * Le tri se fait sur l'état de la commande, pas sur une heuristique de date :
 * tant qu'elle est 'pending', c'est le premier paiement ; une fois 'applied',
 * tout nouveau débit est une reconduction.
 */
export async function finalizeOrderPayment(input: {
  reference: string;
  occurredAt: Date;
  amountCents: number | null;
  currency: string | null;
  /** La notification avait-elle déjà été journalisée ? (rejeu bancaire) */
  isReplay: boolean;
}): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("subscription_orders")
    .select(ORDER_COLUMNS)
    .eq("monetico_reference", input.reference)
    .maybeSingle();
  if (!data) return;
  const order = data as OrderRow;

  if (order.status === "pending") {
    /* Premier paiement. Le verrou de claimOrderPaid n'autorise qu'une seule
       exécution : une re-présentation ne peut pas créer deux contrats.

       Une commande RATTACHÉE à un contrat existant (changement de formule, de
       carte, reprise) ne crée rien : elle met à jour ce contrat. Les
       distinguer sur `subscription_id` et non sur `kind` couvre d'office les
       types qu'on ajoutera demain. */
    if (order.subscription_id) {
      await finalizeChangeOrder(supabase, order, input);
    } else {
      await finalizeAttach(supabase, order, input);
    }
    return;
  }

  if (order.status === "paid") {
    /* État TRANSITOIRE : la commande a été verrouillée mais la création du
       contrat n'est pas allée au bout (coupure, base indisponible). Rejouer à
       l'aveugle est impossible — le verrou a déjà été consommé — donc on
       appelle un humain plutôt que de laisser un paiement sans contrat. */
    await sendBillingAlert("URGENT — Commande payée restée sans contrat", [
      `Cabinet : ${order.billing_snapshot?.cabinetName ?? order.app_cabinet_id}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(input.amountCents ?? order.amount_cents)}`,
      "Le paiement est encaissé, la commande verrouillée, mais l'abonnement n'a pas été créé. Créer le contrat à la main ou rembourser.",
    ]);
    return;
  }

  if (order.status === "applied" && order.role === "recurring") {
    /* Reconduction. Un rejeu de notification (même référence, même code, même
       date) a déjà été traité : le journal l'a dit, on s'arrête. */
    if (input.isReplay) return;
    await finalizeInstalment(supabase, order, input);
    return;
  }

  /* Commande close (refusée, abandonnée, montant inattendu) qui reçoit
     malgré tout un paiement : jamais silencieux. */
  await sendBillingAlert("Paiement reçu sur une commande close", [
    `Cabinet : ${order.billing_snapshot?.cabinetName ?? order.app_cabinet_id}`,
    `Référence : ${input.reference}`,
    `État de la commande : ${order.status}`,
    `Montant : ${formatEuros(input.amountCents ?? order.amount_cents)}`,
    "Vérifier l'encaissement auprès du CIC et régulariser à la main (remboursement ou rattachement).",
  ]);
}

/* ============================================================
   Commande rattachée à un contrat EXISTANT : changement de formule, changement
   de carte, reprise après une reconduction arrêtée.

   CE QUI SE JOUE ICI : le client vient de valider, à l'échéance, la demande
   qu'il avait programmée. On ne crée pas de contrat, on remplace ce qui doit
   l'être sur celui qui existe — formule, montant de reconduction, commande
   récurrente vivante — et on repart pour une période.

   ⚠️ `subscriptions.monetico_reference` SUIT la commande récurrente vivante.
   Ce n'est pas un détail d'archivage : c'est la référence que la banque
   re-présentera à chaque échéance, et celle par laquelle le traitement des
   refus (dunning.ts) retrouve l'abonnement. La laisser sur l'ancienne
   commande, c'est un impayé qui n'est rattaché à personne, donc jamais relancé.
   ============================================================ */
async function finalizeChangeOrder(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  order: OrderRow,
  input: {
    reference: string;
    occurredAt: Date;
    amountCents: number | null;
    currency: string | null;
  },
): Promise<void> {
  if (!order.subscription_id) return;

  const paidCents = input.amountCents ?? order.amount_cents;
  const snap = order.billing_snapshot ?? {};

  /* Garde montant, identique à la souscription : un écart n'applique RIEN.
     Sinon un montant manipulé achèterait une formule supérieure au prix d'une
     autre. */
  if (paidCents !== order.amount_cents) {
    await supabase
      .from("subscription_orders")
      .update({
        status: "amount_mismatch",
        paid_at: input.occurredAt.toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending");
    await sendBillingAlert("URGENT — Changement d'abonnement : montant inattendu", [
      `Cabinet : ${snap.cabinetName ?? order.app_cabinet_id}`,
      `Référence : ${input.reference}`,
      `Montant encaissé : ${formatEuros(paidCents)}`,
      `Montant attendu : ${formatEuros(order.amount_cents)}`,
      "AUCUN changement n'a été appliqué. Vérifier l'encaissement et régulariser à la main.",
    ]);
    return;
  }

  // VERROU d'idempotence : une seule exécution par commande.
  if (!(await claimOrderPaid(supabase, order.id, input.occurredAt))) return;

  const { data: subData } = await supabase
    .from("subscriptions")
    .select(
      "id, app_cabinet_id, cabinet_name, cabinet_address, cabinet_postal_city, admin_email, admin_name, plan, extra_collaborators, currency, status, started_at, current_period_end, renewal_count",
    )
    .eq("id", order.subscription_id)
    .maybeSingle();

  if (!subData) {
    await sendBillingAlert("URGENT — Changement payé sur un contrat introuvable", [
      `Référence : ${input.reference}`,
      `Abonnement visé : ${order.subscription_id}`,
      `Montant : ${formatEuros(paidCents)}`,
      "L'argent est encaissé et le contrat n'existe plus. Rembourser ou recréer le contrat à la main.",
    ]);
    return;
  }

  const sub = subData as {
    id: string;
    app_cabinet_id: string;
    cabinet_name: string;
    cabinet_address: string | null;
    cabinet_postal_city: string | null;
    admin_email: string;
    admin_name: string;
    plan: BillingPlan;
    extra_collaborators: number;
    currency: string;
    status: string;
    started_at: string;
    current_period_end: string;
    renewal_count: number;
  };

  const currency = input.currency ?? order.currency;
  const recurring = order.role === "recurring";

  /* La date de commande, pas l'instant du traitement : c'est elle que la
     banque retient, et c'est d'elle que partira la prochaine échéance. */
  const orderDate = order.monetico_order_date
    ? new Date(`${order.monetico_order_date.split("/").reverse().join("-")}T00:00:00Z`)
    : input.occurredAt;
  const anchor = Number.isNaN(orderDate.getTime()) ? input.occurredAt : orderDate;

  /* NOUVELLE PÉRIODE — la règle diffère, et ce n'est pas un choix esthétique :
     - RÉCURRENT : le TPE reprélèvera un mois après SA date de commande. La
       période doit suivre la banque au jour près, sinon on annonce au client
       une échéance que la banque ne respectera pas.
     - IMMÉDIAT (annuel) : paiement unique, donc rien ne contraint la date. On
       ajoute au terme en cours quand il est encore à venir, pour que payer en
       avance n'ampute jamais la période déjà réglée. */
  const base = recurring
    ? anchor
    : new Date(
        Math.max(new Date(sub.current_period_end).getTime(), anchor.getTime()),
      );
  const periodEnd = addMonthsClamped(base, order.plan === "ANNUAL" ? 12 : 1);

  const label = planLabel(order.plan, order.extra_collaborators);

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      plan: order.plan,
      extra_collaborators: order.extra_collaborators,
      renewal_amount_cents: renewalAmountCents(
        order.plan,
        order.extra_collaborators,
      ),
      currency,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      renewal_count: sub.renewal_count + 1,
      last_renewal_at: input.occurredAt.toISOString(),
      /* L'annuel reste un paiement unique : sa reconduction est arrêtée par
         construction. Le mensuel repart, lui, sur une récurrence vivante. */
      recurrence_stopped_at: recurring ? null : input.occurredAt.toISOString(),
      current_recurring_order_id: recurring ? order.id : null,
      ...(recurring
        ? {
            monetico_reference: order.monetico_reference,
            monetico_order_date: order.monetico_order_date,
          }
        : {}),
      // Le contrat est à jour : plus rien à relancer.
      dunning_started_at: null,
      dunning_failure_count: 0,
      grace_until: null,
      last_failure_code: null,
    })
    .eq("id", sub.id);

  if (updateError) {
    await sendBillingAlert("URGENT — Changement encaissé sans être appliqué", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Nouvelle formule : ${label}`,
      `Erreur : ${updateError.message}`,
      "L'argent est pris et le contrat n'a PAS été mis à jour. Corriger à la main (formule, montant de reconduction, période, commande récurrente).",
    ]);
    return;
  }

  await markOrderApplied(supabase, order.id, sub.id);

  /* La demande programmée est honorée. Best-effort : le contrat est déjà à
     jour, une ligne de suivi restée « en attente » n'a pas d'effet bancaire. */
  try {
    const pending = await activeChange(supabase, sub.id);
    if (pending) await fulfillChange(supabase, pending.id, order.id);
  } catch (err) {
    console.error("[billing-attach] clôture de la demande :", errMessage(err));
  }

  /* Pièce comptable. RÉCURRENT : la banque a autorisé sans encaisser.
     IMMÉDIAT : pris d'office. Même règle que la souscription. */
  const paidAtIso = input.occurredAt.toISOString();
  const { data: ledger } = await supabase
    .from("billing_ledger")
    .insert({
      event_type: "card_payment",
      amount_cents: paidCents,
      currency,
      occurred_at: paidAtIso,
      captured_at: recurring ? null : paidAtIso,
      reference: order.monetico_reference,
      subscription_id: sub.id,
      cabinet_name: sub.cabinet_name,
      meta: { kind: order.kind ?? "change", order_id: order.id },
    })
    .select("id")
    .maybeSingle();

  if (ledger && recurring) {
    try {
      await captureLedgerEntry((ledger as { id: number }).id);
    } catch (err) {
      console.error("[billing-attach] échec encaissement :", errMessage(err));
    }
  }

  // Facture (best-effort : l'argent est entré, la pièce doit exister).
  let invoiceNumber: string | undefined;
  try {
    const invoice = await issueInvoice({
      kind: "card_renewal",
      amountCents: paidCents,
      currency,
      subscriptionId: sub.id,
      cabinetName: sub.cabinet_name,
      cabinetAddress: sub.cabinet_address ?? snap.cabinetAddress ?? "",
      cabinetPostalCity: sub.cabinet_postal_city ?? snap.cabinetPostalCity ?? "",
      planLabel: label,
      reference: order.monetico_reference,
    });
    invoiceNumber = invoice.number;
  } catch (err) {
    console.error("[billing-attach] échec facture :", errMessage(err));
    await sendBillingAlert("Facture de changement non émise", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(paidCents)}`,
      `Erreur : ${errMessage(err)}`,
      "Le changement est appliqué : la facture doit être émise à la main.",
    ]);
  }

  // Reçu au client, avec la reconduction annoncée noir sur blanc.
  try {
    const to = sub.admin_email || snap.adminEmail;
    if (to) {
      const isAnnual = order.plan === "ANNUAL";
      const receipt = paymentReceiptEmail({
        adminFirstName: (sub.admin_name ?? "").trim().split(/\s+/)[0] ?? "",
        cabinetName: sub.cabinet_name,
        planLabel: label,
        amountLabel: formatEuros(paidCents),
        reference: order.monetico_reference,
        paidAtLabel: frDateTime(input.occurredAt),
        invoiceNumber,
        renewal: isAnnual
          ? undefined
          : {
              amountLabel: formatEuros(
                renewalAmountCents(order.plan, order.extra_collaborators),
              ),
              periodLabel: "chaque mois",
              nextDateLabel: frDate(periodEnd),
            },
        accessUntilLabel: isAnnual ? frDate(periodEnd) : undefined,
      });
      await sendMail({ to, ...receipt });
    }
  } catch (err) {
    console.error("[billing-attach] échec reçu :", errMessage(err));
  }

  /* Remontée à l'application.

     `maxAssistants` n'est transmis QUE sur un changement de formule : c'est le
     seul cas où le praticien a lui-même choisi combien de collaborateurs il
     paie. L'envoyer sur un changement de carte ou une reprise réalignerait le
     quota d'un cabinet qui n'a rien demandé — or les chemins de création de
     l'app ne posent pas tous la même valeur (cf. docs, §5.2). */
  try {
    const sync = await notifyRenewal({
      idempotencyKey: `${order.monetico_reference}-${order.kind ?? "change"}`,
      cabinetId: sub.app_cabinet_id,
      plan: order.plan,
      periodEnd: periodEnd.toISOString(),
      paidAt: paidAtIso,
      amountCents: paidCents,
      currency,
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      ...(order.kind === "plan_change"
        ? { maxAssistants: order.extra_collaborators }
        : {}),
    });
    if (!sync.ok) {
      await sendBillingAlert("Changement non remonté à l'application", [
        `Cabinet : ${sub.cabinet_name}`,
        `Référence : ${input.reference}`,
        `Nouvelle formule : ${label}`,
        `Échéance : ${frDate(periodEnd)}`,
        `Erreur : ${sync.reason}`,
        "L'encaissement, le contrat et la facture sont faits ; seule la date affichée dans l'application reste à poser à la main.",
      ]);
    }
  } catch (err) {
    console.error("[billing-attach] échec remontée :", errMessage(err));
  }

  await logAudit({
    action: "billing.subscription_changed",
    entityType: "subscription",
    entityId: sub.id,
    diff: {
      kind: order.kind,
      reference: order.monetico_reference,
      from: planLabel(sub.plan, sub.extra_collaborators),
      to: label,
      periodEnd: periodEnd.toISOString(),
    },
  });
}

/**
 * Reconduction d'un abonnement né hors tunnel : pièce comptable, prolongation,
 * puis facture et reçu par le même chemin que les reconductions du tunnel.
 */
async function finalizeInstalment(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  order: OrderRow,
  input: { reference: string; occurredAt: Date; amountCents: number | null },
): Promise<void> {
  if (!order.subscription_id) return;

  const { data: subData } = await supabase
    .from("subscriptions")
    .select(
      "id, cabinet_name, current_period_end, renewal_count, renewal_amount_cents, currency, status, started_at",
    )
    .eq("id", order.subscription_id)
    .maybeSingle();
  if (!subData) return;
  const sub = subData as {
    id: string;
    cabinet_name: string;
    current_period_end: string;
    renewal_count: number;
    renewal_amount_cents: number;
    currency: string;
    status: string;
    started_at: string;
  };

  const amountCents = input.amountCents ?? sub.renewal_amount_cents;

  /* PIÈCE COMPTABLE D'ABORD, TOUJOURS. Tout débit reçu doit exister au
     journal : une écriture manquante n'est jamais mise en recouvrement et
     devient un trou comptable. L'index unique (référence, date) sur les
     reconductions rend l'insertion idempotente. */
  const { data: ledger, error: ledgerError } = await supabase
    .from("billing_ledger")
    .insert({
      event_type: "card_renewal",
      amount_cents: amountCents,
      currency: sub.currency,
      occurred_at: input.occurredAt.toISOString(),
      reference: input.reference,
      subscription_id: sub.id,
      cabinet_name: sub.cabinet_name,
      meta: { kind: "attach_renewal", order_id: order.id },
    })
    .select("id")
    .maybeSingle();

  // Conflit d'unicité : ce débit était déjà comptabilisé, rien à refaire.
  if (ledgerError || !ledger) return;

  /* GARDE ANTI-DOUBLON DE PREMIER PAIEMENT : une échéance ne peut pas tomber
     moins de 20 jours après la souscription (la période la plus courte est
     mensuelle). Si cela arrive, c'est presque sûrement une re-présentation du
     premier paiement sous une date différente. On garde l'écriture comptable
     (l'argent est peut-être bien parti) mais on NE PROLONGE PAS, et on alerte. */
  const tooEarly =
    input.occurredAt.getTime() <
    new Date(sub.started_at).getTime() + 20 * 86_400_000;
  if (tooEarly) {
    await sendBillingAlert("URGENT — Échéance trop précoce sur un abonnement", [
      `Cabinet : ${sub.cabinet_name}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(amountCents)}`,
      `Souscription le : ${frDate(new Date(sub.started_at))}`,
      `Débit reçu le : ${frDate(input.occurredAt)}`,
      "L'écriture comptable est posée mais la période n'a PAS été prolongée : ce débit ressemble à un doublon du premier paiement. À vérifier au CIC.",
    ]);
    return;
  }

  const base = new Date(
    Math.max(
      new Date(sub.current_period_end).getTime(),
      input.occurredAt.getTime(),
    ),
  );
  const newPeriodEnd = addMonthsClamped(base, order.plan === "ANNUAL" ? 12 : 1);

  await supabase
    .from("subscriptions")
    .update({
      current_period_end: newPeriodEnd.toISOString(),
      // Un abonnement résilié ne « revit » pas ; finalizeRenewal alertera.
      status: sub.status === "canceled" ? sub.status : "active",
      renewal_count: sub.renewal_count + 1,
      last_renewal_at: input.occurredAt.toISOString(),
      dunning_started_at: null,
      dunning_failure_count: 0,
      grace_until: null,
      last_failure_code: null,
    })
    .eq("id", sub.id);

  /* Encaissement, facture, reçu et remontée à l'application : même chemin que
     les reconductions du tunnel, à partir de l'écriture qu'on vient de poser. */
  await finalizeRenewal({
    reference: input.reference,
    occurredAt: input.occurredAt,
    amountCents: input.amountCents,
    amountMismatch:
      input.amountCents !== null && input.amountCents !== sub.renewal_amount_cents,
  });
}

/**
 * Premier paiement d'une commande de souscription. Best-effort après le
 * verrou : l'appelant (route IPN) doit acquitter Monetico quoi qu'il arrive.
 */
async function finalizeAttach(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  order: OrderRow,
  input: {
    reference: string;
    occurredAt: Date;
    amountCents: number | null;
    currency: string | null;
  },
): Promise<void> {
  const paidCents = input.amountCents ?? order.amount_cents;
  const snap = order.billing_snapshot ?? {};
  const cabinetName = snap.cabinetName ?? "(cabinet sans nom)";

  /* Garde montant : l'argent encaissé doit être EXACTEMENT l'attendu. Un écart
     ne crée pas de contrat — sinon un montant manipulé achèterait un
     abonnement au rabais. */
  if (paidCents !== order.amount_cents) {
    await supabase
      .from("subscription_orders")
      .update({ status: "amount_mismatch", paid_at: input.occurredAt.toISOString() })
      .eq("id", order.id)
      .eq("status", "pending");
    await sendBillingAlert("URGENT — Souscription : montant inattendu", [
      `Cabinet : ${cabinetName}`,
      `Référence : ${input.reference}`,
      `Montant encaissé : ${formatEuros(paidCents)}`,
      `Montant attendu : ${formatEuros(order.amount_cents)}`,
      "AUCUN abonnement n'a été créé. Vérifier l'encaissement et régulariser à la main.",
    ]);
    return;
  }

  // VERROU d'idempotence : une seule exécution par commande.
  if (!(await claimOrderPaid(supabase, order.id, input.occurredAt))) return;

  /* Période : le mois (ou l'année) court depuis la DATE DE COMMANDE, pas
     depuis l'instant du traitement — la banque peut notifier le lendemain. */
  const periodStart = order.monetico_order_date
    ? new Date(
        `${order.monetico_order_date.split("/").reverse().join("-")}T00:00:00Z`,
      )
    : input.occurredAt;
  const startedAt = input.occurredAt;
  const periodEnd = addMonthsClamped(
    Number.isNaN(periodStart.getTime()) ? startedAt : periodStart,
    order.plan === "ANNUAL" ? 12 : 1,
  );

  const currency = input.currency ?? order.currency;

  // 1. Le contrat.
  const { data: subRow, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      pending_signup_id: null, // né hors tunnel : aucun dossier d'inscription
      app_cabinet_id: order.app_cabinet_id,
      app_user_id: order.app_user_id ?? "",
      cabinet_name: cabinetName,
      cabinet_email: snap.adminEmail ?? "",
      cabinet_address: snap.cabinetAddress ?? "",
      cabinet_postal_city: snap.cabinetPostalCity ?? "",
      admin_email: snap.adminEmail ?? "",
      admin_name: snap.adminName ?? "",
      invoice_prefix: snap.invoicePrefix ?? "",
      plan: order.plan,
      extra_collaborators: order.extra_collaborators,
      first_payment_cents: paidCents,
      renewal_amount_cents: renewalAmountCents(order.plan, order.extra_collaborators),
      currency,
      status: "active",
      started_at: startedAt.toISOString(),
      current_period_end: periodEnd.toISOString(),
      monetico_reference: order.monetico_reference,
      monetico_order_date: order.monetico_order_date,
      /* L'annuel est un paiement UNIQUE : aucune reconduction carte à
         attendre, on le marque tout de suite (même règle que le worker). */
      recurrence_stopped_at:
        order.plan === "ANNUAL" ? startedAt.toISOString() : null,
      notes: "Souscription depuis l'espace abonnement (cabinet existant).",
    })
    .select("id")
    .single();

  if (subError || !subRow) {
    await sendBillingAlert("URGENT — Souscription encaissée sans contrat créé", [
      `Cabinet : ${cabinetName}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(paidCents)}`,
      `Erreur : ${subError?.message ?? "aucune ligne"}`,
      "L'argent est pris et AUCUN abonnement n'existe. Créer le contrat à la main ou rembourser.",
    ]);
    return;
  }
  const subscriptionId = subRow.id as string;

  await markOrderApplied(supabase, order.id, subscriptionId);

  // La commande devient la récurrence vivante (mensuel uniquement).
  if (order.role === "recurring") {
    await supabase
      .from("subscriptions")
      .update({ current_recurring_order_id: order.id })
      .eq("id", subscriptionId);
  }

  /* 2. Pièce comptable. RÉCURRENT : la banque a autorisé sans encaisser,
     captured_at reste NULL jusqu'à la mise en recouvrement. IMMÉDIAT : pris
     d'office, on l'acte tout de suite. */
  const paidAtIso = input.occurredAt.toISOString();
  const { data: ledger } = await supabase
    .from("billing_ledger")
    .insert({
      event_type: "card_payment",
      amount_cents: paidCents,
      currency,
      occurred_at: paidAtIso,
      captured_at: order.plan === "ANNUAL" ? paidAtIso : null,
      reference: order.monetico_reference,
      subscription_id: subscriptionId,
      cabinet_name: cabinetName,
      meta: { kind: "attach" },
    })
    .select("id")
    .maybeSingle();

  // 3. Encaissement effectif (récurrent seulement).
  if (ledger && order.plan !== "ANNUAL") {
    try {
      await captureLedgerEntry((ledger as { id: number }).id);
    } catch (err) {
      // captureLedgerEntry alerte déjà ; le cron de rattrapage réessaiera.
      console.error("[billing-attach] échec encaissement :", errMessage(err));
    }
  }

  const label = planLabel(order.plan, order.extra_collaborators);
  const firstName = (snap.adminName ?? "").trim().split(/\s+/)[0] ?? "";

  // 4. Facture (best-effort).
  let invoiceNumber: string | undefined;
  try {
    const invoice = await issueInvoice({
      kind: "card_first",
      amountCents: paidCents,
      currency,
      subscriptionId,
      cabinetName,
      cabinetAddress: snap.cabinetAddress ?? "",
      cabinetPostalCity: snap.cabinetPostalCity ?? "",
      planLabel: label,
      reference: order.monetico_reference,
    });
    invoiceNumber = invoice.number;
  } catch (err) {
    console.error("[billing-attach] échec facture :", errMessage(err));
    await sendBillingAlert("Facture de souscription non émise", [
      `Cabinet : ${cabinetName}`,
      `Référence : ${input.reference}`,
      `Montant : ${formatEuros(paidCents)}`,
      `Erreur : ${errMessage(err)}`,
      "L'abonnement est en place : la facture doit être émise à la main.",
    ]);
  }

  /* 5. Reçu au client. MENSUEL : reconduction automatique, donc montant,
     rythme et prochaine date annoncés par écrit (obligation d'information sur
     un abonnement à tacite reconduction). ANNUEL : paiement unique, on annonce
     la date jusqu'à laquelle l'accès est garanti. */
  try {
    if (snap.adminEmail) {
      const isAnnual = order.plan === "ANNUAL";
      const receipt = paymentReceiptEmail({
        adminFirstName: firstName,
        cabinetName,
        planLabel: label,
        amountLabel: formatEuros(paidCents),
        reference: order.monetico_reference,
        paidAtLabel: frDateTime(input.occurredAt),
        invoiceNumber,
        renewal: isAnnual
          ? undefined
          : {
              amountLabel: formatEuros(
                renewalAmountCents(order.plan, order.extra_collaborators),
              ),
              periodLabel: "chaque mois",
              nextDateLabel: frDate(periodEnd),
            },
        accessUntilLabel: isAnnual ? frDate(periodEnd) : undefined,
      });
      await sendMail({ to: snap.adminEmail, ...receipt });
    }
  } catch (err) {
    console.error("[billing-attach] échec reçu :", errMessage(err));
  }

  /* 6. Remontée à l'application : sans elle, le praticien voit « aucun
     abonnement » dans son logiciel alors qu'il vient de payer. No-op tant que
     la route n'est pas livrée côté dev B (PROVISIONING_RENEWAL_ENABLED). */
  try {
    const sync = await notifyRenewal({
      idempotencyKey: `${order.monetico_reference}-attach`,
      cabinetId: order.app_cabinet_id,
      plan: order.plan,
      periodEnd: periodEnd.toISOString(),
      paidAt: paidAtIso,
      amountCents: paidCents,
      currency,
    });
    if (!sync.ok) {
      await sendBillingAlert("Souscription non remontée à l'application", [
        `Cabinet : ${cabinetName}`,
        `Référence : ${input.reference}`,
        `Échéance : ${frDate(periodEnd)}`,
        `Erreur : ${sync.reason}`,
        "L'encaissement, le contrat et la facture sont faits ; seule la date affichée dans l'application reste à poser à la main.",
      ]);
    }
  } catch (err) {
    console.error("[billing-attach] échec remontée :", errMessage(err));
  }

  await logAudit({
    action: "billing.subscription_attached",
    entityType: "subscription",
    entityId: subscriptionId,
    diff: {
      reference: order.monetico_reference,
      appCabinetId: order.app_cabinet_id,
      plan: order.plan,
      periodEnd: periodEnd.toISOString(),
    },
  });
}
