import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { canCollectPayment, paymentProvider, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isSameOriginJsonPost } from "@/lib/http/origin-guard";
import { openSession, PORTAL_COOKIE } from "@/lib/billing/portal";
import { openOrder, openStripeOrder } from "@/lib/billing/orders";
import {
  checkoutAmountCents,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import { consentDocumentsSnapshot, TERMS_LABEL } from "@/lib/legal/registry";

/* ============================================================
   POST /api/portal/subscribe — souscription d'un cabinet EXISTANT.

   Ouvre une commande `attach` et rend le formulaire Monetico scellé. Aucun
   compte n'est créé : le cabinet existe déjà dans l'application, seule sa
   facturation est mise en place. C'est précisément ce que le tunnel de vente
   ne sait pas faire (il appelle toujours provisionCabinet, qui répond 409 sur
   un cabinet connu, après encaissement).

   Le montant est calculé ICI, par la grille tarifaire : ni le navigateur ni
   l'application métier ne peuvent l'influencer.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "La souscription est momentanément indisponible.";

export async function POST(request: NextRequest) {
  if (!canCollectPayment()) {
    return Response.json({ error: GENERIC }, { status: 503 });
  }
  if (!isSameOriginJsonPost(request)) {
    return Response.json({ error: "Requête refusée." }, { status: 403 });
  }

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: GENERIC }, { status: 503 });

  const jar = await cookies();
  const session = openSession(jar.get(PORTAL_COOKIE)?.value);
  if (!session) {
    return Response.json(
      { error: "Votre session a expiré. Rouvrez votre espace depuis le logiciel." },
      { status: 401 },
    );
  }

  const ip = clientIpFrom(request.headers);
  const { data: allowed } = await supabase.rpc("hit_rate_limit", {
    p_bucket: `portal-subscribe:${ip}`,
    p_limit: 10,
    p_window_seconds: 600,
  });
  if (allowed === false) {
    return Response.json({ error: "Trop de tentatives." }, { status: 429 });
  }

  let plan: BillingPlan;
  let extra: number;
  try {
    const body = (await request.json()) as {
      plan?: unknown;
      extraCollaborators?: unknown;
    };
    plan = body.plan === "MONTHLY" ? "MONTHLY" : "ANNUAL";
    extra = Number(body.extraCollaborators ?? 0);
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!Number.isInteger(extra) || extra < 0 || extra > MAX_EXTRA_COLLABORATORS) {
    return Response.json({ error: "Nombre de collaborateurs invalide." }, { status: 422 });
  }

  /* Garde CRITIQUE, identique au tunnel : la fréquence de reconduction est
     portée par le code site Monetico. Vendre une formule dont aucun code site
     ne porte le rythme, c'est prélever au mauvais intervalle. */
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

  /* Un abonnement vivant interdit d'en ouvrir un second (l'index unique par
     cabinet le refuserait de toute façon, autant le dire proprement ici). */
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("app_cabinet_id", session.appCabinetId)
    .in("status", ["active", "past_due", "suspended", "pending_mandate"])
    .maybeSingle();
  if (existing) {
    return Response.json(
      { error: "Un abonnement est déjà en cours pour ce cabinet." },
      { status: 409 },
    );
  }

  const amountCents = checkoutAmountCents(plan, extra);
  const c = session.cabinet;

  /* Preuve de consentement — MÊME EXIGENCE QUE LE TUNNEL (art. 5 CGV v2.1) :
     libellé exact affiché, versions et empreintes des documents, identité,
     horodatage serveur. Sans preuve, on n'encaisse pas. */
  const { data: consent, error: consentError } = await supabase
    .from("consent_records")
    .insert({
      kind: "contract_terms",
      pending_root_id: null, // souscription hors tunnel : pas de chaîne de checkout
      label_text: TERMS_LABEL,
      documents: consentDocumentsSnapshot(),
      accepted_at: new Date().toISOString(),
      full_name: c.adminName || c.name,
      email: c.adminEmail,
      client_ip: ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();
  if (consentError || !consent) {
    console.error(
      "[portal-subscribe] insert consent_records :",
      consentError?.message ?? "aucune ligne",
    );
    return Response.json({ error: GENERIC }, { status: 502 });
  }
  const consentRecordId = (consent as { id: string }).id;

  const commande = {
    kind: "attach" as const,
    plan,
    extraCollaborators: extra,
    amountCents,
    appCabinetId: session.appCabinetId,
    appUserId: session.appUserId,
    subscriptionId: null,
    billingSnapshot: {
      cabinetName: c.name,
      cabinetAddress: c.address,
      cabinetPostalCity: `${c.postalCode} ${c.city}`.trim(),
      adminEmail: c.adminEmail,
      adminName: c.adminName,
      invoicePrefix: c.invoicePrefix,
    },
    consentRecordId,
    clientIp: ip,
    returnPath: "/mon-abonnement/merci",
    errorPath: "/mon-abonnement/echec",
  };

  /* Lien retour preuve → commande (trace, best-effort). */
  const rattacherPreuve = async (orderId: string) => {
    await supabase
      .from("consent_records")
      .update({ subscription_order_id: orderId })
      .eq("id", consentRecordId);
  };

  try {
    /* Deux prestataires, deux formes de réponse, et le composant côté client
       les distingue par la présence de `url`. Stripe renvoie une adresse vers
       laquelle rediriger ; Monetico, un formulaire scellé à auto-soumettre. */
    if (paymentProvider() === "stripe") {
      const opened = await openStripeOrder(supabase, commande);
      await rattacherPreuve(opened.orderId);
      return Response.json({ url: opened.url, reference: opened.reference });
    }

    const opened = await openOrder(supabase, commande);
    await rattacherPreuve(opened.orderId);
    return Response.json({
      action: opened.form.action,
      fields: opened.form.fields,
      reference: opened.reference,
    });
  } catch (err) {
    console.error(
      "[portal-subscribe] ouverture de commande :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC }, { status: 502 });
  }
}
