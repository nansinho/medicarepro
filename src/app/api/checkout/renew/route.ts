import { type NextRequest } from "next/server";
import { env, hasCheckout } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isSameOriginJsonPost } from "@/lib/http/origin-guard";
import { buildPaymentForm } from "@/lib/monetico";
import { moneticoConfigForPlan } from "@/lib/billing/monetico-routing";
import {
  verifyRenewalToken,
  newRenewalReference,
} from "@/lib/billing/renewal-link";
import { renewalAmountCents } from "@/lib/checkout/pricing";

/* ============================================================
   POST /api/checkout/renew — ouvre le paiement de renouvellement
   d'un abonnement ANNUEL (offre one-shot). Le jeton signé du lien
   de renouvellement identifie la souscription ; on crée un dossier
   subscription_renewals puis on renvoie le formulaire Monetico
   (TPE immédiat, encaissé d'office). L'IPN prolongera le compte.

   Réservé à l'annuel : le mensuel se reconduit tout seul.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Le renouvellement est momentanément indisponible.";

export async function POST(request: NextRequest) {
  if (!hasCheckout()) {
    return Response.json({ error: GENERIC }, { status: 503 });
  }
  /* Même garde que les autres routes qui ouvrent un paiement : ce POST ne
     doit venir que de NOS pages. Le jeton de renouvellement n'expire pas et
     ne s'use pas — sans cette garde, quiconque le retrouve dans une boîte mail
     peut ouvrir des dossiers de paiement en série depuis n'importe où. */
  if (!isSameOriginJsonPost(request)) {
    return Response.json({ error: "Requête refusée." }, { status: 403 });
  }

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: GENERIC }, { status: 503 });

  // Anti-abus : le jeton gate l'accès, mais on borne quand même par IP.
  const ip = clientIpFrom(request.headers);
  const { data: allowed } = await supabase.rpc("hit_rate_limit", {
    p_bucket: `renew:${ip}`,
    p_limit: 10,
    p_window_seconds: 600,
  });
  if (allowed === false) {
    return Response.json({ error: "Trop de tentatives." }, { status: 429 });
  }

  let token = "";
  try {
    token = String(((await request.json()) as { token?: unknown }).token ?? "");
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const subscriptionId = verifyRenewalToken(token);
  if (!subscriptionId) {
    return Response.json({ error: "Lien de renouvellement invalide." }, { status: 400 });
  }

  const { data: subData } = await supabase
    .from("subscriptions")
    .select(
      "id, plan, status, admin_email, cabinet_name, cabinet_address, cabinet_postal_city, extra_collaborators",
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subData) {
    return Response.json({ error: "Abonnement introuvable." }, { status: 404 });
  }
  const sub = subData as {
    id: string;
    plan: "MONTHLY" | "ANNUAL";
    status: string;
    admin_email: string;
    cabinet_name: string;
    cabinet_address: string;
    cabinet_postal_city: string;
    extra_collaborators: number;
  };

  // Le renouvellement self-service ne concerne QUE l'annuel (le mensuel se
  // reconduit par carte). Et on ne renouvelle pas un abonnement résilié.
  if (sub.plan !== "ANNUAL") {
    return Response.json(
      { error: "Le renouvellement en ligne ne concerne que l'offre 12 mois." },
      { status: 422 },
    );
  }
  if (sub.status === "canceled") {
    return Response.json(
      { error: "Cet abonnement est résilié. Contactez-nous pour le réactiver." },
      { status: 422 },
    );
  }

  const amountCents = renewalAmountCents("ANNUAL", sub.extra_collaborators);
  const reference = newRenewalReference();
  const config = moneticoConfigForPlan("ANNUAL");

  // Découpe "13120 GARDANNE" en CP + ville pour le contexte 3DS.
  const cpCity = sub.cabinet_postal_city.trim();
  const m = /^(\d{5})\s+(.+)$/.exec(cpCity);

  /* URL de retour bâtie sur NEXT_PUBLIC_SITE_URL, comme le tunnel
     d'inscription — et SURTOUT PAS sur request.nextUrl.origin, qui vaut
     « https://0.0.0.0:3000 » en production (le serveur standalone se rabat sur
     HOSTNAME et PORT). Cette URL part SCELLÉE DANS LE MAC vers Monetico : une
     origine fausse renvoie un client qui vient d'être débité sur une adresse
     injoignable, sans correction possible après coup. */
  /* Deux adresses DISTINCTES : Monetico refuse `url_retour_ok` et
     `url_retour_err` identiques. Un renouvellement refusé atterrissait sur
     « Merci, votre renouvellement est pris en compte » — le contraire de ce
     qui venait de se passer. */
  const siteBase = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const returnUrl = `${siteBase}/renouvellement/merci?ref=${reference}`;
  const errorUrl = `${siteBase}/renouvellement/echec?ref=${reference}`;

  let form;
  try {
    form = buildPaymentForm(
      {
        reference,
        amountCents,
        email: sub.admin_email,
        urlRetourOk: returnUrl,
        urlRetourErr: errorUrl,
        billingContext: {
          addressLine1: sub.cabinet_address || "—",
          city: m?.[2] ?? (cpCity || "—"),
          postalCode: m?.[1] ?? "",
          country: "FR",
        },
      },
      config,
    );
  } catch (err) {
    console.error(
      "[checkout-renew] buildPaymentForm :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC }, { status: 502 });
  }

  // Dossier de renouvellement (l'IPN le retrouvera par la référence).
  const { error: insErr } = await supabase.from("subscription_renewals").insert({
    subscription_id: sub.id,
    monetico_reference: reference,
    monetico_order_date: form.fields["date"].slice(0, 10),
    monetico_platform: config.mode,
    amount_cents: amountCents,
    currency: "EUR",
    client_ip: ip,
  });
  if (insErr) {
    console.error("[checkout-renew] insert renewal :", insErr.message);
    return Response.json({ error: GENERIC }, { status: 502 });
  }

  return Response.json({ action: form.action, fields: form.fields, reference });
}
