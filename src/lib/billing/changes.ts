import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/service";
import { billingEnv } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { stopRecurrence } from "@/lib/billing/recurrence";
import { notifyRenewal } from "@/lib/provisioning";
import {
  renewalAmountCents,
  planLabel,
  formatEuros,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import {
  changeScheduledEmail,
  changeWithdrawnEmail,
  cancellationScheduledEmail,
} from "@/lib/emails/portal-templates";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";

/* ============================================================
   Changements d'abonnement demandés par le praticien.

   LA CONTRAINTE QUI DICTE TOUT : Monetico ne modifie pas une commande
   récurrente en place. Changer de carte ou de formule impose d'arrêter la
   commande et d'en ouvrir une nouvelle — et une nouvelle commande récurrente
   encaisse un mois plein le jour même, en remettant le cycle à zéro. Appliquer
   un changement à la demande ferait donc payer deux fois le mois en cours.

   D'où le déroulé, en trois temps :
     1. DEMANDE — on arrête la reconduction (accusé bancaire exigé) et on
        enregistre l'intention (migration 0032) ;
     2. ATTENTE — l'accès court jusqu'au terme déjà réglé, rien n'est débité ;
     3. ÉCHÉANCE — le client valide sa nouvelle formule par un paiement, qui
        ouvre la commande récurrente suivante et relance l'automatisme.

   ⚠️ L'ARRÊT DE RÉCURRENCE EST IRRÉVERSIBLE côté banque. Un client qui se
   ravise garde sa formule mais devra quand même valider un paiement à
   l'échéance. Toute interface qui déclenche `scheduleChange` doit l'avoir dit
   AVANT, en toutes lettres.

   SI LA BANQUE REFUSE L'ARRÊT, la demande est enregistrée quand même et
   l'arrêt passe en tâche manuelle (alerte URGENT, tableau de bord CIC). Ce
   n'était pas le choix initial — on refusait la demande — mais le refus
   observé le 05/08/2026 (« commande non authentifiee » sur une requête
   pourtant conforme à la doc technique v2.0, cf. src/lib/billing/recurrence.ts)
   enfermait le praticien : ni résiliation, ni changement de formule, sans
   qu'il y soit pour rien. Son intention est un fait contractuel : elle
   s'enregistre, et nous nous engageons à l'honorer — au besoin en remboursant
   un prélèvement que l'arrêt manuel n'aurait pas devancé.

   Comment se relit cet état, sans colonne nouvelle : une demande 'scheduled'
   alors que subscriptions.recurrence_stopped_at est NULL = arrêt bancaire
   encore à poser.
   ============================================================ */

export type ChangeKind = "plan_change" | "card_update" | "cancel";
export type ChangeStatus = "scheduled" | "fulfilled" | "withdrawn" | "lapsed";

export type SubscriptionChange = {
  id: string;
  subscription_id: string;
  app_cabinet_id: string;
  kind: ChangeKind;
  target_plan: BillingPlan | null;
  target_extra_collaborators: number | null;
  target_amount_cents: number | null;
  status: ChangeStatus;
  effective_at: string;
  reason: string | null;
  created_at: string;
};

export const CHANGE_COLUMNS =
  "id, subscription_id, app_cabinet_id, kind, target_plan, target_extra_collaborators, target_amount_cents, status, effective_at, reason, created_at";

/** Contrat, vu par cette couche. */
export type ChangeableSubscription = {
  id: string;
  app_cabinet_id: string;
  cabinet_name: string;
  admin_email: string;
  admin_name: string;
  plan: BillingPlan;
  extra_collaborators: number;
  status: string;
  current_period_end: string;
  recurrence_stopped_at: string | null;
  /* Identification de la commande a la banque : necessaire pour dire, dans
     l'alerte, laquelle arreter a la main quand le service refuse. */
  monetico_reference: string;
  monetico_order_date: string | null;
  payment_provider: "monetico" | "stripe" | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  first_payment_cents: number;
};

export const CHANGEABLE_SUBSCRIPTION_COLUMNS =
  "id, app_cabinet_id, cabinet_name, admin_email, admin_name, plan, extra_collaborators, status, current_period_end, recurrence_stopped_at, monetico_reference, monetico_order_date, first_payment_cents, payment_provider, stripe_subscription_id, stripe_customer_id";

/** États dans lesquels un contrat accepte encore une demande. */
const OPEN_STATUSES = new Set([
  "active",
  "past_due",
  "suspended",
  "pending_mandate",
]);

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

function frDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

async function sendBillingAlert(title: string, lines: string[]): Promise<void> {
  try {
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    console.error("[billing-changes] échec alerte :", errMessage(err));
  }
}

/* ------------------------------------------------------------
   Lectures.
   ------------------------------------------------------------ */

/** Le changement en attente d'un abonnement, s'il y en a un. */
export async function activeChange(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<SubscriptionChange | null> {
  const { data } = await supabase
    .from("subscription_changes")
    .select(CHANGE_COLUMNS)
    .eq("subscription_id", subscriptionId)
    .eq("status", "scheduled")
    .maybeSingle();
  return (data as SubscriptionChange | null) ?? null;
}

/**
 * Formule visée par un changement — c'est elle qui décide du TPE, donc du
 * rythme de reconduction. Un changement de carte reconduit la formule en
 * cours ; une résiliation n'en vise aucune.
 */
export function targetOf(
  change: SubscriptionChange,
  sub: { plan: BillingPlan; extra_collaborators: number },
): { plan: BillingPlan; extraCollaborators: number } | null {
  if (change.kind === "cancel") return null;
  if (change.kind === "card_update") {
    return { plan: sub.plan, extraCollaborators: sub.extra_collaborators };
  }
  return {
    plan: change.target_plan ?? sub.plan,
    extraCollaborators:
      change.target_extra_collaborators ?? sub.extra_collaborators,
  };
}

/**
 * À partir de quand le changement est-il payable ?
 *
 * MENSUEL : pas avant le terme. Le TPE récurrent fait repartir le cycle du
 * jour du paiement — régler trois jours trop tôt, c'est offrir trois jours à
 * la banque. On préfère faire patienter, et le dire.
 *
 * ANNUEL : tout de suite. Le paiement est unique et la période s'ajoute au
 * terme en cours (`finalizeRenewal`), donc rien ne se perd à payer en avance.
 *
 * IMPAYÉ : tout de suite, quelle que soit la formule. L'échéance est due, la
 * nouvelle carte est là pour la régler — c'est précisément ce qu'on attend.
 */
export function payableFrom(
  change: SubscriptionChange,
  sub: { plan: BillingPlan; extra_collaborators: number; status: string },
): Date | null {
  if (change.kind === "cancel") return null;
  if (sub.status === "past_due" || sub.status === "suspended") return new Date(0);
  const target = targetOf(change, sub);
  if (!target) return null;
  if (target.plan === "ANNUAL") return new Date(0);
  return new Date(change.effective_at);
}

/** Le changement est-il payable maintenant ? */
export function isPayableNow(
  change: SubscriptionChange,
  sub: { plan: BillingPlan; extra_collaborators: number; status: string },
): boolean {
  const from = payableFrom(change, sub);
  return from !== null && from.getTime() <= Date.now();
}

/* ------------------------------------------------------------
   Programmation d'un changement.
   ------------------------------------------------------------ */

export type ScheduleInput = {
  subscription: ChangeableSubscription;
  kind: ChangeKind;
  /** 'plan_change' seulement. */
  targetPlan?: BillingPlan;
  /** 'plan_change' seulement. */
  targetExtraCollaborators?: number;
  /** Motif de résiliation, facultatif. */
  reason?: string | null;
  via: "portal" | "admin";
  requestedByAdmin?: string | null;
  clientIp?: string | null;
};

export type ScheduleOutcome =
  /* `bankStopPending` : la demande est enregistrée mais la banque n'a pas
     accusé l'arrêt. L'appelant peut en tenir compte dans ce qu'il affiche ;
     l'équipe est alertée dans tous les cas. */
  | { ok: true; change: SubscriptionChange; bankStopPending: boolean }
  | { ok: false; status: number; error: string };

export async function scheduleChange(
  input: ScheduleInput,
): Promise<ScheduleOutcome> {
  const supabase = serviceClient();
  if (!supabase) {
    return { ok: false, status: 503, error: "Service indisponible." };
  }

  const sub = input.subscription;

  if (!OPEN_STATUSES.has(sub.status)) {
    return {
      ok: false,
      status: 409,
      error: "Cet abonnement n'est plus en cours.",
    };
  }

  const existing = await activeChange(supabase, sub.id);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error:
        "Une demande est déjà enregistrée sur cet abonnement. Retirez-la avant d'en faire une autre.",
    };
  }

  /* Cible et montant annoncé. Le montant est recalculé à l'ouverture de la
     commande : ce qu'on enregistre ici est la promesse faite au client, pas le
     prix qui sera présenté à la banque. */
  let targetPlan: BillingPlan | null = null;
  let targetExtra: number | null = null;
  let targetAmount: number | null = null;

  if (input.kind === "plan_change") {
    targetPlan = input.targetPlan === "MONTHLY" ? "MONTHLY" : "ANNUAL";
    targetExtra = Number(input.targetExtraCollaborators ?? 0);
    if (
      !Number.isInteger(targetExtra) ||
      targetExtra < 0 ||
      targetExtra > MAX_EXTRA_COLLABORATORS
    ) {
      return {
        ok: false,
        status: 422,
        error: "Nombre de collaborateurs invalide.",
      };
    }
    if (targetPlan === sub.plan && targetExtra === sub.extra_collaborators) {
      return {
        ok: false,
        status: 422,
        error: "C'est déjà votre formule actuelle.",
      };
    }

    /* Même garde que le tunnel et la souscription : la fréquence de
       reconduction est portée par le code site Monetico. Programmer une
       formule dont aucun code site ne porte le rythme, c'est promettre un
       changement qu'on ne saura pas encaisser à l'échéance. */
    const { checkoutPlans } = billingEnv();
    const sellable =
      checkoutPlans === "all" ||
      (checkoutPlans === "monthly" && targetPlan === "MONTHLY") ||
      (checkoutPlans === "annual" && targetPlan === "ANNUAL");
    if (!sellable) {
      return {
        ok: false,
        status: 422,
        error: "Cette formule n'est pas disponible pour le moment.",
      };
    }

    targetAmount = renewalAmountCents(targetPlan, targetExtra);
  }

  /* ARRÊT DE LA RECONDUCTION — avant toute écriture.
     Un changement enregistré sans arrêt effectif, c'est un client prélevé au
     tarif et sur la carte qu'on vient de lui annoncer abandonnés. L'annuel n'a
     rien à arrêter : son paiement est unique, la reconduction est marquée
     arrêtée dès la souscription. */
  let stopLib: string | null = null;
  /* Vrai quand la banque n'a PAS accusé l'arrêt : la demande est enregistrée
     quand même, et l'arrêt reste à poser à la main depuis le tableau de bord
     CIC. Se relit ailleurs sans colonne nouvelle : une demande active alors
     que subscriptions.recurrence_stopped_at est vide, c'est exactement ça. */
  let bankStopPending = false;
  /* Commande réellement visée par l'appel bancaire — pas forcément celle du
     contrat après un changement antérieur. C'est elle que l'alerte doit citer
     pour que l'arrêt manuel porte sur la bonne. */
  let stopTarget: NonNullable<
    Awaited<ReturnType<typeof stopRecurrence>>["target"]
  > | null = null;

  if (!sub.recurrence_stopped_at) {
    const outcome = await stopRecurrence(sub.id);
    if (outcome.ok) {
      stopLib = outcome.lib || null;
    } else {
      /* REFUS BANCAIRE : on n'abandonne PAS la demande du client.
         Constaté le 05/08/2026 : « commande non authentifiee » sur toutes nos
         demandes stoprecurrence, alors que le même service authentifie la même
         commande pour un recouvrement, et alors que la requête est conforme à
         la documentation technique v2.0 (jeu de champs, sceau, montants à
         0EUR, tous vérifiés). En attente du CIC.
         Faire échouer la demande pour autant, ce serait punir le praticien
         d'un problème de paramétrage qui ne le regarde pas, et l'enfermer :
         il ne peut ni résilier ni changer de formule. On enregistre donc son
         intention — qui est un fait contractuel, indépendant de la banque —,
         on alerte l'équipe, et un humain pose l'arrêt au CIC. Il y a un mois
         entier avant la prochaine échéance pour le faire. */
      bankStopPending = true;
      stopLib = outcome.lib || outcome.message.slice(0, 200);
      stopTarget = outcome.target ?? null;
    }
  }

  const effectiveAt = sub.current_period_end;

  const { data, error } = await supabase
    .from("subscription_changes")
    .insert({
      subscription_id: sub.id,
      app_cabinet_id: sub.app_cabinet_id,
      kind: input.kind,
      target_plan: targetPlan,
      target_extra_collaborators: targetExtra,
      target_amount_cents: targetAmount,
      status: "scheduled",
      effective_at: effectiveAt,
      recurrence_stop_lib: stopLib,
      requested_via: input.via,
      requested_by_admin: input.requestedByAdmin ?? null,
      requested_ip: input.clientIp ?? null,
      reason: (input.reason ?? "").trim().slice(0, 2000) || null,
    })
    .select(CHANGE_COLUMNS)
    .single();

  if (error || !data) {
    /* La reconduction, elle, EST arrêtée : on ne peut pas faire comme si rien
       ne s'était passé. Un humain doit reprendre la main, sinon le client
       n'est plus reconduit sans que rien ne le dise. */
    await sendBillingAlert("URGENT — Reconduction arrêtée sans demande enregistrée", [
      `Cabinet : ${sub.cabinet_name}`,
      `Abonnement : ${sub.id}`,
      `Demande : ${input.kind}`,
      `Erreur : ${error?.message ?? "aucune ligne"}`,
      "La banque ne reconduira plus cet abonnement et AUCUNE demande n'est enregistrée : le client ne verra rien à valider à l'échéance. Recréer la demande à la main.",
    ]);
    return {
      ok: false,
      status: 502,
      error:
        "Votre demande n'a pas pu être enregistrée. Notre équipe est prévenue, écrivez-nous à contact@medicarepro.fr.",
    };
  }

  const change = data as SubscriptionChange;

  /* ARRÊT BANCAIRE NON OBTENU : la demande est enregistrée, mais la banque
     continuera de prélever tant qu'un humain n'aura pas posé l'arrêt. C'est
     la seule chose qui puisse encore coûter de l'argent au client, donc
     l'alerte est nominative et donne le geste exact à faire. */
  if (bankStopPending) {
    await sendBillingAlert("URGENT — Arrêt de récurrence à poser À LA MAIN", [
      `Cabinet : ${sub.cabinet_name}`,
      `Demande : ${input.kind}`,
      `Référence Monetico : ${stopTarget?.reference ?? sub.monetico_reference}`,
      `Date de commande : ${stopTarget?.orderDateLabel ?? sub.monetico_order_date ?? "(inconnue)"}`,
      `Montant : ${formatEuros(stopTarget?.amountCents ?? sub.first_payment_cents)}`,
      `Réponse de la banque : ${stopLib ?? "(sans libellé)"}`,
      `Prochaine échéance : ${frDate(effectiveAt)} — c'est le délai pour agir.`,
      "À FAIRE : arrêter la reconduction de cette commande depuis le tableau de bord CIC. La demande du client EST enregistrée et il a reçu sa confirmation ; sans ce geste, il sera prélevé malgré tout.",
    ]);
  }

  /* Remontée à l'application. UNIQUEMENT pour la résiliation : c'est le seul
     cas où le contrat s'arrête. Un changement de formule ou de carte n'est pas
     une fin d'abonnement, et l'annoncer comme telle afficherait « résilié »
     dans le logiciel d'un praticien qui voulait juste un collaborateur de
     plus. */
  if (input.kind === "cancel") {
    try {
      const sync = await notifyRenewal({
        idempotencyKey: `sub-${sub.id}-cancel-${change.id.slice(0, 8)}`,
        cabinetId: sub.app_cabinet_id,
        plan: sub.plan,
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
      });
      if (!sync.ok) {
        await sendBillingAlert("Résiliation non remontée à l'application", [
          `Cabinet : ${sub.cabinet_name}`,
          `Terme : ${frDate(effectiveAt)}`,
          `Erreur : ${sync.reason}`,
          "La résiliation est bien enregistrée ici ; seul l'affichage dans l'application reste à corriger à la main.",
        ]);
      }
    } catch (err) {
      console.error("[billing-changes] échec remontée :", errMessage(err));
    }
  }

  // Confirmation écrite au client (best-effort : jamais bloquant).
  try {
    if (sub.admin_email) {
      const firstName = (sub.admin_name ?? "").trim().split(/\s+/)[0] ?? "";
      const mail =
        input.kind === "cancel"
          ? cancellationScheduledEmail({
              adminFirstName: firstName,
              cabinetName: sub.cabinet_name,
              currentPlanLabel: planLabel(sub.plan, sub.extra_collaborators),
              accessUntilLabel: frDate(effectiveAt),
              bankStopPending,
            })
          : changeScheduledEmail({
              adminFirstName: firstName,
              cabinetName: sub.cabinet_name,
              kind: input.kind,
              currentPlanLabel: planLabel(sub.plan, sub.extra_collaborators),
              targetPlanLabel:
                targetPlan && targetExtra !== null
                  ? planLabel(targetPlan, targetExtra)
                  : planLabel(sub.plan, sub.extra_collaborators),
              targetAmountLabel: formatEuros(
                targetAmount ?? renewalAmountCents(sub.plan, sub.extra_collaborators),
              ),
              effectiveAtLabel: frDate(effectiveAt),
              /* La date d'effet n'est PAS la date de règlement. Sur un passage
                 à l'annuel, `payableFrom` ouvre le paiement tout de suite : le
                 client voyait « à régler le 1er septembre » et trouvait le
                 bouton de paiement actif dans son espace le jour même. */
              payableNow: isPayableNow(change, sub),
              bankStopPending,
            });
      await sendMail({ to: sub.admin_email, ...mail });
    }
  } catch (err) {
    console.error("[billing-changes] échec email :", errMessage(err));
  }

  await logAudit({
    action: "billing.change_scheduled",
    entityType: "subscription",
    entityId: sub.id,
    diff: {
      kind: input.kind,
      targetPlan,
      targetExtra,
      effectiveAt,
      via: input.via,
    },
  });

  return { ok: true, change, bankStopPending };
}

/* ------------------------------------------------------------
   Retrait d'une demande.
   ------------------------------------------------------------ */

export type WithdrawOutcome =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Le client se ravise.
 *
 * ⚠️ Ce qui NE revient PAS : la reconduction automatique. L'arrêt envoyé à
 * Monetico est définitif, aucun service ne le rejoue. Retirer la demande rend
 * donc la formule d'origine, pas l'automatisme : le client devra valider un
 * paiement à l'échéance. L'interface doit l'annoncer, et l'email le confirme.
 */
export async function withdrawChange(input: {
  subscription: ChangeableSubscription;
  change: SubscriptionChange;
  via: "portal" | "admin";
  requestedByAdmin?: string | null;
}): Promise<WithdrawOutcome> {
  const supabase = serviceClient();
  if (!supabase) {
    return { ok: false, status: 503, error: "Service indisponible." };
  }

  const { data, error } = await supabase
    .from("subscription_changes")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", input.change.id)
    .eq("status", "scheduled")
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "Cette demande n'est plus en attente.",
    };
  }

  const sub = input.subscription;

  // Résiliation retirée : le logiciel doit cesser d'annoncer une fin de contrat.
  if (input.change.kind === "cancel") {
    try {
      await notifyRenewal({
        idempotencyKey: `sub-${sub.id}-uncancel-${input.change.id.slice(0, 8)}`,
        cabinetId: sub.app_cabinet_id,
        plan: sub.plan,
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
      });
    } catch (err) {
      console.error("[billing-changes] échec remontée :", errMessage(err));
    }
  }

  try {
    if (sub.admin_email) {
      const mail = changeWithdrawnEmail({
        adminFirstName: (sub.admin_name ?? "").trim().split(/\s+/)[0] ?? "",
        cabinetName: sub.cabinet_name,
        wasCancellation: input.change.kind === "cancel",
        currentPlanLabel: planLabel(sub.plan, sub.extra_collaborators),
        renewOnLabel: frDate(input.change.effective_at),
        renewAmountLabel: formatEuros(
          renewalAmountCents(sub.plan, sub.extra_collaborators),
        ),
      });
      await sendMail({ to: sub.admin_email, ...mail });
    }
  } catch (err) {
    console.error("[billing-changes] échec email :", errMessage(err));
  }

  await logAudit({
    action: "billing.change_withdrawn",
    entityType: "subscription",
    entityId: sub.id,
    diff: { changeId: input.change.id, kind: input.change.kind, via: input.via },
  });

  return { ok: true };
}

/* ------------------------------------------------------------
   Issue.
   ------------------------------------------------------------ */

/** Le paiement est passé : la demande est honorée. */
export async function fulfillChange(
  supabase: SupabaseClient,
  changeId: string,
  orderId: string,
): Promise<void> {
  await supabase
    .from("subscription_changes")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_order_id: orderId,
    })
    .eq("id", changeId)
    .eq("status", "scheduled");
}

/** L'échéance est passée sans paiement (cron). */
export async function lapseChange(
  supabase: SupabaseClient,
  changeId: string,
): Promise<void> {
  await supabase
    .from("subscription_changes")
    .update({ status: "lapsed", lapsed_at: new Date().toISOString() })
    .eq("id", changeId)
    .eq("status", "scheduled");
}
