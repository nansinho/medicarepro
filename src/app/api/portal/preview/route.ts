import { type NextRequest } from "next/server";
import { guardPortalPost, liveSubscription } from "@/lib/billing/portal-guard";
import { previewStripeChange } from "@/lib/stripe/subscription";
import { MAX_EXTRA_COLLABORATORS, type BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   POST /api/portal/preview — ce que coûtera un changement.

   POURQUOI CETTE ROUTE EXISTE. Stripe proratise sans rien prélever sur le
   moment : la différence s'ajoute à la prochaine facture. Le praticien validait
   donc un changement et ne voyait aucun mouvement, sans savoir ce qui l'attendait
   — constaté le 05/08/2026, où l'écran annonçait « à régler le 5 septembre »
   pendant que le changement s'appliquait déjà.

   ELLE NE MODIFIE RIEN. Stripe calcule la facture qu'il émettrait, on la lit, on
   la jette. Aucune écriture en base, aucun appel qui engage.

   Elle reste néanmoins derrière la même garde que les actions : session valide,
   même origine, plafond par IP. Une route de simulation ouverte laisserait
   n'importe qui interroger le catalogue et les échéances d'un cabinet.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  /* Plafond plus large que les actions : l'écran interroge à chaque clic sur le
     compteur de collaborateurs, et c'est sans conséquence. */
  const guard = await guardPortalPost(request, "portal-preview", 60);
  if (!guard.ok) return guard.response;
  const { supabase, session } = guard.ctx;

  let body: { plan?: unknown; extraCollaborators?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const plan: BillingPlan = body.plan === "MONTHLY" ? "MONTHLY" : "ANNUAL";
  const extra = Number(body.extraCollaborators ?? 0);
  if (!Number.isInteger(extra) || extra < 0 || extra > MAX_EXTRA_COLLABORATORS) {
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

  /* Sans abonnement Stripe, il n'y a rien à simuler : l'ancien parcours fait
     payer le tarif plein à l'échéance, et l'écran le dit déjà. */
  if (sub.payment_provider !== "stripe" || !sub.stripe_subscription_id) {
    return Response.json({ available: false });
  }

  try {
    const apercu = await previewStripeChange({
      subscriptionId: sub.stripe_subscription_id,
      plan,
      extraCollaborators: extra,
    });
    return Response.json({
      available: true,
      prorationCents: apercu.prorationCents,
      nextInvoiceCents: apercu.nextInvoiceCents,
      nextInvoiceDate: apercu.nextInvoiceDate?.toISOString() ?? null,
    });
  } catch (err) {
    /* Un aperçu indisponible ne doit pas empêcher de changer de formule : on
       renvoie « pas de simulation », et l'écran affiche le tarif sans détail. */
    console.error(
      "[portal-preview] aperçu impossible :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ available: false });
  }
}
