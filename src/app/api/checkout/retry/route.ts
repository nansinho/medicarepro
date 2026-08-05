import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canCollectPayment } from "@/lib/env";
import { createSubscriptionCheckout } from "@/lib/stripe/checkout";
import { createSignupCustomer } from "@/lib/stripe/customer";
import { serviceClient } from "@/lib/supabase/service";
import { timingSafeEqualString } from "@/lib/crypto";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isSameOriginJsonPost } from "@/lib/http/origin-guard";

/* ============================================================
   POST /api/checkout/retry — rouvrir la page de paiement d'un dossier
   d'inscription resté impayé.

   CE QUE CETTE ROUTE FAISAIT AVANT, ET POURQUOI ELLE NE LE FAIT PLUS.
   Une commande Monetico refusée ne peut pas être repayée : il fallait donc
   créer un NOUVEAU dossier — nouvelle référence, secrets re-chiffrés parce que
   l'AAD change avec elle, nouvelle RUM, nouveau texte de mandat, nouveau jeton
   de suivi — chaîner l'ancien en `superseded`, et re-vérifier les
   disponibilités auprès de l'application. Quatre cents lignes pour contourner
   une limite bancaire.

   Stripe rouvre une session sur la même référence. Le dossier ne bouge pas, ses
   secrets restent déchiffrables, sa preuve de consentement reste rattachée.

   Deux défauts connus ont disparu avec l'ancienne branche : elle n'écrivait
   jamais `monetico_order_date` (d'où une résiliation automatique impossible),
   et son plafond de 5 tentatives par heure contredisait celui du tunnel, à 30.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_FAILURE =
  "Une erreur technique est survenue. Réessayez dans quelques minutes.";

const RetrySchema = z.object({
  reference: z.string().regex(/^[A-Z0-9]{12}$/, "Référence invalide"),
});

type OldRow = {
  id: string;
  monetico_reference: string;
  status: string;
  status_token: string;
  plan: "MONTHLY" | "ANNUAL";
  extra_collaborators: number;
  password_enc: string | null;
  cabinet: {
    name: string;
    email: string;
    address: string;
    city: string;
    postalCode: string;
  };
  stripe_customer_id: string | null;
};

export async function POST(request: NextRequest) {
  if (!canCollectPayment()) {
    return Response.json(
      { error: "Le tunnel d'inscription n'est pas encore ouvert." },
      { status: 503 },
    );
  }
  if (!isSameOriginJsonPost(request)) {
    return Response.json({ error: "Requête refusée." }, { status: 403 });
  }
  const supabase: SupabaseClient | null = serviceClient();
  if (!supabase) {
    return Response.json(
      { error: "Le tunnel d'inscription n'est pas encore ouvert." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = RetrySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Formulaire invalide.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const reference = parsed.data.reference;

  // Cookie porteur : même contrôle que /api/checkout/status.
  const cookie = request.cookies.get("mp_checkout")?.value ?? "";
  const dot = cookie.indexOf(".");
  const cookieRef = dot > 0 ? cookie.slice(0, dot) : "";
  const cookieToken = dot > 0 ? cookie.slice(dot + 1) : "";
  if (!cookieRef || !cookieToken || cookieRef !== reference) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data, error: loadError } = await supabase
    .from("pending_signups")
    .select(
      "id, monetico_reference, status, status_token, plan, extra_collaborators, password_enc, cabinet, stripe_customer_id",
    )
    .eq("monetico_reference", reference)
    .maybeSingle();
  if (loadError || !data) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }
  const dossier = data as OldRow;

  if (!timingSafeEqualString(cookieToken, dossier.status_token)) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  /* Plafond par IP. Aligné sur celui du tunnel : rouvrir une page de paiement
     ne coûte rien de plus que d'en ouvrir une, et un praticien dont la carte
     est refusée deux fois n'a pas à être bloqué une heure. */
  const ip = clientIpFrom(request.headers);
  const { data: allowed, error: rlError } = await supabase.rpc(
    "hit_rate_limit",
    { p_bucket: `checkout:${ip}`, p_limit: 30, p_window_seconds: 3600 },
  );
  if (rlError) {
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }
  if (allowed === false) {
    return Response.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 },
    );
  }

  /* Rejouable UNIQUEMENT depuis un dossier non payé. Un dossier déjà réglé
     rouvrirait une caisse sur un abonnement qui existe. */
  if (dossier.status !== "payment_pending") {
    return Response.json(
      { error: "Ce dossier ne peut plus être rejoué." },
      { status: 409 },
    );
  }
  if (!dossier.password_enc) {
    // Secrets purgés (dossier trop ancien) : repasser par le formulaire.
    return Response.json(
      { error: "Ce dossier a expiré. Recommencez votre inscription." },
      { status: 409 },
    );
  }

  try {
    const customerId =
      dossier.stripe_customer_id ??
      (await createSignupCustomer({
        reference: dossier.monetico_reference,
        name: dossier.cabinet.name,
        email: dossier.cabinet.email,
        address: dossier.cabinet.address,
        postalCode: dossier.cabinet.postalCode,
        city: dossier.cabinet.city,
      }));

    /* Idempotent sur la référence : dans les 24 heures, Stripe rend la MÊME
       session, toujours ouverte, plutôt que d'en créer une seconde sur laquelle
       le client pourrait payer une deuxième fois. Passé ce délai la session a
       expiré et une nouvelle est ouverte, ce qui est le comportement voulu. */
    const { url, sessionId } = await createSubscriptionCheckout({
      reference: dossier.monetico_reference,
      plan: dossier.plan,
      extraCollaborators: dossier.extra_collaborators,
      customerId,
      successPath: "/inscription/confirmation",
      errorPath: "/inscription/echec",
      metadata: { kind: "signup" },
    });

    await supabase
      .from("pending_signups")
      .update({
        stripe_checkout_session_id: sessionId,
        stripe_customer_id: customerId,
        /* Le motif du refus précédent est effacé : sans quoi l'écran de suivi
           continuerait d'annoncer un paiement refusé pendant que le client est
           en train d'en faire un nouveau. */
        code_retour: null,
      })
      .eq("id", dossier.id);

    return Response.json({ redirectUrl: url, reference: dossier.monetico_reference });
  } catch (err) {
    console.error(
      "[checkout-retry] session Stripe :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }
}
