import { type NextRequest } from "next/server";
import { hasCheckout, billingEnv } from "@/lib/env";
import { guardPortalPost, liveSubscription } from "@/lib/billing/portal-guard";
import { openOrder } from "@/lib/billing/orders";
import {
  activeChange,
  targetOf,
  isPayableNow,
  payableFrom,
} from "@/lib/billing/changes";
import {
  renewalAmountCents,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import { consentDocumentsSnapshot, TERMS_LABEL } from "@/lib/legal/registry";

/* ============================================================
   POST /api/portal/pay — ouvre le paiement qui engage réellement.

   Trois situations mènent ici, et une seule commande en sort :
     - honorer un changement programmé arrivé à échéance ;
     - reprendre un abonnement dont la reconduction est arrêtée ;
     - renouveler une offre annuelle avant son terme.

   LE MONTANT EST CALCULÉ ICI, par la grille tarifaire, à partir de la formule
   visée. Ni le navigateur ni la demande enregistrée ne peuvent l'influencer :
   `target_amount_cents` n'est qu'une trace de ce qui a été annoncé au client.

   POURQUOI UNE PREUVE DE CONSENTEMENT À CHAQUE FOIS : ce paiement ouvre un
   NOUVEL engagement de reconduction (nouvelle commande, nouveau prélèvement
   récurrent). C'est la même exigence que le tunnel — libellé exact affiché,
   versions et empreintes des documents, identité, horodatage serveur.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Le paiement est momentanément indisponible.";

function frDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export async function POST(request: NextRequest) {
  if (!hasCheckout()) {
    return Response.json({ error: GENERIC }, { status: 503 });
  }

  const guard = await guardPortalPost(request, "portal-pay", 10);
  if (!guard.ok) return guard.response;
  const { supabase, session, ip, userAgent } = guard.ctx;

  let acceptTerms = false;
  let wantedPlan: BillingPlan | null = null;
  let wantedExtra: number | null = null;
  try {
    const body = (await request.json()) as {
      acceptTerms?: unknown;
      plan?: unknown;
      extraCollaborators?: unknown;
    };
    acceptTerms = body.acceptTerms === true;
    if (body.plan === "MONTHLY" || body.plan === "ANNUAL") {
      wantedPlan = body.plan;
    }
    if (body.extraCollaborators !== undefined) {
      wantedExtra = Number(body.extraCollaborators);
    }
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!acceptTerms) {
    return Response.json(
      { error: "Merci d'accepter les conditions pour continuer." },
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

  const change = await activeChange(supabase, sub.id);

  /* --- Quelle formule, et à quel titre ? -------------------------------- */

  let kind: "plan_change" | "card_update" | "resubscribe";
  let plan: BillingPlan;
  let extra: number;

  if (change) {
    if (change.kind === "cancel") {
      return Response.json(
        {
          error:
            "Votre abonnement est résilié. Annulez d'abord la résiliation pour pouvoir le reprendre.",
        },
        { status: 409 },
      );
    }
    if (!isPayableNow(change, sub)) {
      const from = payableFrom(change, sub);
      return Response.json(
        {
          error: `Votre changement sera à régler à partir du ${frDate(from ?? change.effective_at)}. Payer avant ferait repartir votre mois de facturation dès aujourd'hui, et vous perdriez les jours déjà réglés.`,
        },
        { status: 409 },
      );
    }
    const target = targetOf(change, sub);
    if (!target) {
      return Response.json({ error: GENERIC }, { status: 500 });
    }
    kind = change.kind;
    plan = target.plan;
    extra = target.extraCollaborators;
  } else {
    /* Aucune demande enregistrée. Reste le cas du contrat sans reconduction :
       annuel arrivant à terme, ou mensuel dont la récurrence a été arrêtée
       (demande retirée, résiliation annulée, arrêt fait depuis le back-office).
       Un mensuel dont la reconduction est bien vivante n'a rien à régler : la
       banque s'en charge, et encaisser en plus serait un doublon. */
    if (!sub.recurrence_stopped_at) {
      return Response.json(
        {
          error:
            "Votre abonnement se reconduit automatiquement : il n'y a rien à régler.",
        },
        { status: 409 },
      );
    }

    plan = wantedPlan ?? sub.plan;
    extra = wantedExtra ?? sub.extra_collaborators;
    if (
      !Number.isInteger(extra) ||
      extra < 0 ||
      extra > MAX_EXTRA_COLLABORATORS
    ) {
      return Response.json(
        { error: "Nombre de collaborateurs invalide." },
        { status: 422 },
      );
    }
    /* Reprendre à l'identique ou en changeant de formule sont deux faits
       différents dans l'historique de facturation, et le second doit réaligner
       le quota de collaborateurs côté logiciel. */
    kind =
      plan === sub.plan && extra === sub.extra_collaborators
        ? "resubscribe"
        : "plan_change";

    /* Un MENSUEL repris avant son terme repartirait du jour du paiement : les
       jours restants seraient perdus. On refuse, comme pour un changement
       programmé, plutôt que de le laisser payer à son détriment. */
    const periodEnd = new Date(sub.current_period_end);
    const stillRunning = periodEnd.getTime() > Date.now();
    const inArrears = sub.status === "past_due" || sub.status === "suspended";
    if (plan === "MONTHLY" && stillRunning && !inArrears) {
      return Response.json(
        {
          error: `Votre accès est réglé jusqu'au ${frDate(periodEnd)}. La reprise sera possible à partir de cette date, pour ne pas vous faire perdre les jours déjà payés.`,
        },
        { status: 409 },
      );
    }
  }

  /* Garde formule : la fréquence de reconduction est portée par le code site
     Monetico. Encaisser une formule dont aucun code site ne porte le rythme,
     c'est prélever au mauvais intervalle. */
  const { checkoutPlans } = billingEnv();
  const sellable =
    checkoutPlans === "all" ||
    (checkoutPlans === "monthly" && plan === "MONTHLY") ||
    (checkoutPlans === "annual" && plan === "ANNUAL");
  if (!sellable) {
    return Response.json(
      { error: "Cette formule n'est pas disponible pour le moment." },
      { status: 422 },
    );
  }

  const amountCents = renewalAmountCents(plan, extra);
  const c = session.cabinet;

  // Preuve de consentement — avant d'ouvrir quoi que ce soit chez la banque.
  const { data: consent, error: consentError } = await supabase
    .from("consent_records")
    .insert({
      kind: "contract_terms",
      pending_root_id: null,
      label_text: TERMS_LABEL,
      documents: consentDocumentsSnapshot(),
      accepted_at: new Date().toISOString(),
      full_name: c.adminName || c.name,
      email: c.adminEmail,
      client_ip: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();
  if (consentError || !consent) {
    console.error(
      "[portal-pay] insert consent_records :",
      consentError?.message ?? "aucune ligne",
    );
    return Response.json({ error: GENERIC }, { status: 502 });
  }
  const consentRecordId = (consent as { id: string }).id;

  /* Une commande ouverte et jamais réglée reste payable jusqu'à son expiration.
     Deux onglets, deux paiements : on ferme les précédentes AVANT d'en ouvrir
     une nouvelle. Si l'ancienne est malgré tout réglée, la finalisation la
     verra close et alertera plutôt que d'encaisser en silence. */
  await supabase
    .from("subscription_orders")
    .update({ status: "expired" })
    .eq("subscription_id", sub.id)
    .eq("status", "pending");

  try {
    const opened = await openOrder(supabase, {
      kind,
      plan,
      extraCollaborators: extra,
      amountCents,
      appCabinetId: session.appCabinetId,
      appUserId: session.appUserId,
      subscriptionId: sub.id,
      billingSnapshot: {
        cabinetName: c.name || sub.cabinet_name,
        cabinetAddress: c.address,
        cabinetPostalCity: `${c.postalCode} ${c.city}`.trim(),
        adminEmail: c.adminEmail || sub.admin_email,
        adminName: c.adminName || sub.admin_name,
        invoicePrefix: c.invoicePrefix,
      },
      consentRecordId,
      clientIp: ip,
      returnPath: "/mon-abonnement/merci",
    });

    await supabase
      .from("consent_records")
      .update({ subscription_order_id: opened.orderId })
      .eq("id", consentRecordId);

    return Response.json({
      action: opened.form.action,
      fields: opened.form.fields,
      reference: opened.reference,
    });
  } catch (err) {
    console.error(
      "[portal-pay] ouverture de commande :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC }, { status: 502 });
  }
}
