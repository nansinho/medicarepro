import { type NextRequest } from "next/server";
import { hasCheckout } from "@/lib/env";
import { guardPortalPost, liveSubscription } from "@/lib/billing/portal-guard";
import {
  scheduleChange,
  withdrawChange,
  activeChange,
  type ChangeKind,
} from "@/lib/billing/changes";
import {
  changeStripePlan,
  setStripeCancelAtPeriodEnd,
  startStripeCardUpdate,
} from "@/lib/stripe/subscription";
import { applyPlanLocally, noteCancellation } from "@/lib/billing/stripe-sync";
import { MAX_EXTRA_COLLABORATORS, type BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   POST /api/portal/change — le praticien demande une modification.

   Quatre actions, un seul point d'entrée, parce qu'elles partagent exactement
   la même mécanique bancaire : arrêter la reconduction en cours et enregistrer
   ce qu'on honorera à l'échéance (cf. src/lib/billing/changes.ts).

     - "plan"     : nouvelle formule et/ou nombre de collaborateurs
     - "card"     : même formule, nouvelle carte
     - "cancel"   : résiliation au terme
     - "withdraw" : retrait de la demande en cours

   AUCUN PAIEMENT N'EST DÉCLENCHÉ ICI. Cette route n'ouvre pas de commande :
   elle enregistre une intention. Le paiement, c'est /api/portal/pay, et
   seulement à partir de la date d'effet.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["plan", "card", "cancel", "withdraw"]);

export async function POST(request: NextRequest) {
  const guard = await guardPortalPost(request, "portal-change", 12);
  if (!guard.ok) return guard.response;
  const { supabase, session, ip } = guard.ctx;

  let action = "";
  let plan: BillingPlan = "ANNUAL";
  let extra = 0;
  let reason = "";
  try {
    const body = (await request.json()) as {
      action?: unknown;
      plan?: unknown;
      extraCollaborators?: unknown;
      reason?: unknown;
    };
    action = String(body.action ?? "");
    plan = body.plan === "MONTHLY" ? "MONTHLY" : "ANNUAL";
    extra = Number(body.extraCollaborators ?? 0);
    reason = typeof body.reason === "string" ? body.reason : "";
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!ACTIONS.has(action)) {
    return Response.json({ error: "Action inconnue." }, { status: 400 });
  }
  if (
    action === "plan" &&
    (!Number.isInteger(extra) || extra < 0 || extra > MAX_EXTRA_COLLABORATORS)
  ) {
    return Response.json(
      { error: "Nombre de collaborateurs invalide." },
      { status: 422 },
    );
  }

  const sub = await liveSubscription(supabase, session.appCabinetId);
  if (!sub) {
    return Response.json(
      { error: "Aucun abonnement en cours pour ce cabinet." },
      { status: 404 },
    );
  }

  /* --- Retrait d'une demande ------------------------------------------- */

  if (action === "withdraw") {
    const change = await activeChange(supabase, sub.id);
    if (!change) {
      return Response.json(
        { error: "Aucune demande en attente." },
        { status: 404 },
      );
    }
    const outcome = await withdrawChange({
      subscription: sub,
      change,
      via: "portal",
    });
    if (!outcome.ok) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json({ ok: true });
  }

  /* --- Programmation d'un changement ------------------------------------ */

  /* Un changement de formule ouvrira une commande à l'échéance : refuser tout
     de suite si le paiement en ligne est fermé, plutôt que de promettre un
     changement qu'on ne saura pas encaisser. Une résiliation, elle, n'a aucun
     paiement à honorer : elle reste possible en toute circonstance. */
  if (action !== "cancel" && !hasCheckout()) {
    return Response.json(
      {
        error:
          "La modification en ligne est momentanément indisponible. Écrivez-nous à contact@medicarepro.fr.",
      },
      { status: 503 },
    );
  }

  /* ------------------------------------------------------------
     ABONNEMENT STRIPE : effet immédiat, sans demande en attente.

     Toute la mécanique de « demande enregistrée, honorée au terme » n'existait
     que parce qu'une commande récurrente Monetico ne se modifiait pas. Stripe
     modifie un abonnement en place, et surtout ANNULER UNE RÉSILIATION redonne
     réellement la reconduction — ce que l'arrêt bancaire, irréversible, ne
     permettait pas.

     Ce qui ne change pas : une résiliation prend effet au TERME de la période
     déjà réglée, jamais le jour même, et sans remboursement au prorata.
     ------------------------------------------------------------ */
  if (sub.payment_provider === "stripe" && sub.stripe_subscription_id) {
    try {
      if (action === "cancel") {
        const { currentPeriodEnd } = await setStripeCancelAtPeriodEnd(
          sub.stripe_subscription_id,
          true,
        );
        await noteCancellation(supabase, sub, reason, ip, true, currentPeriodEnd);
        return Response.json({ ok: true, cancelAtPeriodEnd: true });
      }

      if (action === "withdraw") {
        const { currentPeriodEnd } = await setStripeCancelAtPeriodEnd(
          sub.stripe_subscription_id,
          false,
        );
        await noteCancellation(supabase, sub, null, ip, false, currentPeriodEnd);
        return Response.json({ ok: true, cancelAtPeriodEnd: false });
      }

      if (action === "plan") {
        const { currentPeriodEnd } = await changeStripePlan({
          subscriptionId: sub.stripe_subscription_id,
          plan,
          extraCollaborators: extra,
        });
        await applyPlanLocally(supabase, sub, plan, extra, currentPeriodEnd);
        return Response.json({ ok: true, appliedNow: true });
      }

      // action === "card"
      if (!sub.stripe_customer_id) {
        return Response.json(
          { error: "Moyen de paiement introuvable. Écrivez-nous à contact@medicarepro.fr." },
          { status: 409 },
        );
      }
      const { url } = await startStripeCardUpdate({
        customerId: sub.stripe_customer_id,
        subscriptionId: sub.stripe_subscription_id,
        reference: `${sub.monetico_reference}-carte-${Date.now().toString(36)}`,
      });
      return Response.json({ ok: true, url });
    } catch (err) {
      console.error(
        "[portal-change] Stripe :",
        err instanceof Error ? err.message : String(err),
      );
      return Response.json(
        {
          error:
            "La modification n'a pas pu être appliquée. Réessayez, ou écrivez-nous à contact@medicarepro.fr.",
        },
        { status: 502 },
      );
    }
  }

  const kind: ChangeKind =
    action === "plan"
      ? "plan_change"
      : action === "card"
        ? "card_update"
        : "cancel";

  const outcome = await scheduleChange({
    subscription: sub,
    kind,
    targetPlan: action === "plan" ? plan : undefined,
    targetExtraCollaborators: action === "plan" ? extra : undefined,
    reason: action === "cancel" ? reason : null,
    via: "portal",
    clientIp: ip,
  });

  if (!outcome.ok) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({ ok: true, change: outcome.change });
}
