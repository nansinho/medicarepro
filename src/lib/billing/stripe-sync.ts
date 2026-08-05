import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyRenewal } from "@/lib/provisioning";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { renewalAmountCents, planLabel, type BillingPlan } from "@/lib/checkout/pricing";
import { cancellationScheduledEmail } from "@/lib/emails/portal-templates";
import type { ChangeableSubscription } from "@/lib/billing/changes";

/* ============================================================
   Répercuter chez nous ce que Stripe vient d'appliquer.

   Stripe est la source de vérité de l'abonnement : montant, échéance,
   reconduction. Notre registre n'est plus qu'une copie lisible — mais une copie
   qui doit être juste, parce que c'est ELLE que le praticien voit dans son
   espace, et elle que l'application métier reçoit.

   Rien ici ne décide : tout est constaté après coup. Si une écriture échoue,
   l'abonnement reste correct chez Stripe et le prochain `invoice.paid` remettra
   notre copie d'aplomb.
   ============================================================ */

function frDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Un changement de formule appliqué à l'instant.
 *
 * `maxAssistants` est remonté à l'application, sinon le logiciel continuerait
 * de refuser un collaborateur que le cabinet vient de payer. Et surtout, on ne
 * remonte JAMAIS de résiliation ici : un changement de formule n'est pas une
 * fin d'abonnement, et l'annoncer comme telle afficherait « résilié » dans le
 * logiciel d'un praticien qui vient au contraire d'agrandir son cabinet.
 */
export async function applyPlanLocally(
  supabase: SupabaseClient,
  sub: ChangeableSubscription,
  plan: BillingPlan,
  extraCollaborators: number,
  currentPeriodEnd: Date | null,
): Promise<void> {
  await supabase
    .from("subscriptions")
    .update({
      plan,
      extra_collaborators: extraCollaborators,
      renewal_amount_cents: renewalAmountCents(plan, extraCollaborators),
      status: "active",
      ...(currentPeriodEnd
        ? { current_period_end: currentPeriodEnd.toISOString() }
        : {}),
      /* Un changement volontaire solde tout incident antérieur : le praticien
         vient de payer, il n'est plus en défaut. */
      dunning_started_at: null,
      dunning_failure_count: 0,
      grace_until: null,
      last_failure_code: null,
    })
    .eq("id", sub.id);

  const sync = await notifyRenewal({
    idempotencyKey: `stripe-plan-${sub.id}-${plan}-${extraCollaborators}`,
    cabinetId: sub.app_cabinet_id,
    plan,
    periodEnd: currentPeriodEnd?.toISOString(),
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    maxAssistants: extraCollaborators,
  });
  if (!sync.ok) {
    console.error("[stripe-sync] remontée du changement :", sync.reason);
  }

  await logAudit({
    action: "billing.plan_changed_now",
    entityType: "subscription",
    entityId: sub.id,
    diff: { plan, extraCollaborators, provider: "stripe" },
  });
}

/**
 * Une résiliation programmée au terme, ou son annulation.
 *
 * L'annulation est la vraie nouveauté : chez Monetico l'arrêt bancaire était
 * définitif, et revenir en arrière ne rendait pas la reconduction. Trois emails
 * devaient l'expliquer au client. Ici, elle revient réellement.
 */
export async function noteCancellation(
  supabase: SupabaseClient,
  sub: ChangeableSubscription,
  reason: string | null,
  clientIp: string | null,
  cancelling: boolean,
  currentPeriodEnd: Date | null,
): Promise<void> {
  await supabase
    .from("subscriptions")
    .update({
      /* `recurrence_stopped_at` dit « plus rien ne repartira tout seul ». C'est
         exactement ce qu'une résiliation programmée signifie, et son annulation
         le défait — ce que Monetico ne permettait pas. */
      recurrence_stopped_at: cancelling ? new Date().toISOString() : null,
      ...(currentPeriodEnd
        ? { current_period_end: currentPeriodEnd.toISOString() }
        : {}),
    })
    .eq("id", sub.id);

  const sync = await notifyRenewal({
    idempotencyKey: `stripe-cancel-${sub.id}-${cancelling ? "on" : "off"}-${
      currentPeriodEnd?.toISOString() ?? "na"
    }`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    periodEnd: currentPeriodEnd?.toISOString(),
    /* ACTIVE, pas CANCELED : l'accès est dû jusqu'au terme déjà réglé. Seul
       `cancelAtPeriodEnd` dit ce qui se passera ensuite. */
    status: "ACTIVE",
    cancelAtPeriodEnd: cancelling,
  });
  if (!sync.ok) {
    console.error("[stripe-sync] remontée de résiliation :", sync.reason);
  }

  if (cancelling && sub.admin_email) {
    try {
      const fin = currentPeriodEnd ?? new Date(sub.current_period_end);
      const mail = cancellationScheduledEmail({
        adminFirstName: (sub.admin_name ?? "").trim().split(/\s+/)[0] ?? "",
        cabinetName: sub.cabinet_name,
        currentPlanLabel: planLabel(sub.plan, sub.extra_collaborators),
        accessUntilLabel: frDate(fin),
        /* Chez Stripe l'arrêt est acquis à l'instant : plus de « nous
           finalisons auprès de votre banque », plus d'engagement de
           remboursement au cas où un prélèvement passerait quand même. */
        bankStopPending: false,
        /* Chez Stripe, la résiliation se défait d'un clic : l'email doit le
           dire, au lieu de laisser croire qu'il faudra repayer pour repartir. */
        reversible: true,
      });
      await sendMail({ to: sub.admin_email, ...mail });
    } catch (err) {
      console.error(
        "[stripe-sync] email de résiliation :",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await logAudit({
    action: cancelling ? "billing.cancel_scheduled" : "billing.cancel_withdrawn",
    entityType: "subscription",
    entityId: sub.id,
    diff: { provider: "stripe", reason, clientIp },
  });
}
