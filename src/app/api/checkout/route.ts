import { type NextRequest } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasBilling, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { encryptSecret } from "@/lib/crypto";
import { buildPaymentForm } from "@/lib/monetico";
import { CheckoutSchema } from "@/lib/checkout/schema";
import { verifyRppsOnline } from "@/lib/checkout/rpps";
import { checkoutAmountCents } from "@/lib/checkout/pricing";
import { invoicePrefixCandidates } from "@/lib/checkout/invoice-prefix";
import {
  checkAvailability,
  ProvisioningUnavailableError,
} from "@/lib/provisioning";
import { clientIpFrom } from "@/lib/http/client-ip";
import { isSameOriginJsonPost } from "@/lib/http/origin-guard";
import { logAudit } from "@/lib/audit";
import { MANDATE_TEXT_VERSION, mandateText } from "@/lib/sepa/mandate-text";
import { mandateTextSha256 } from "@/lib/sepa/mandate-hash";
import { maskIban } from "@/lib/sepa/iban";
import { consentDocumentsSnapshot, TERMS_LABEL } from "@/lib/legal/registry";

/* ============================================================
   POST /api/checkout — ouverture d'un dossier d'inscription payante.
   Valide le dossier complet (contrat dev B + SEPA + consentements),
   vérifie les disponibilités FAIL-CLOSED, chiffre les secrets au
   repos, réserve RUM + préfixe de facturation, puis renvoie le
   formulaire Monetico scellé à auto-soumettre.
   Réponses : 200 { action, fields, reference } (+ cookie mp_checkout)
   | 403 | 409 générique | 422 | 429 | 502 | 503.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Message unique des refus de disponibilité — ne désigne JAMAIS le champ
    en cause (anti-énumération d'emails/SIRET déjà clients). */
const GENERIC_CONFLICT =
  "Ces informations ne permettent pas de créer un compte. Vérifiez vos saisies ou contactez-nous.";

const GENERIC_FAILURE =
  "Une erreur technique est survenue. Réessayez dans quelques minutes.";

/* ------------------------------------------------------------
   Référence Monetico : "MP" + 10 caractères Crockford base32
   (A-Z0-9 sans I, L, O, U) — 12 alphanumériques au total.
   256 % 32 === 0 : le modulo ne biaise pas le tirage.
   ------------------------------------------------------------ */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function newMoneticoReference(): string {
  const bytes = randomBytes(10);
  let out = "MP";
  for (let i = 0; i < 10; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

/** Cookie httpOnly de suivi du dossier : "<référence>.<status_token>". */
function checkoutCookie(reference: string, statusToken: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `mp_checkout=${reference}.${statusToken}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax${secure}`;
}

/** Vérification Turnstile côté serveur (timeout 5 s, fail-closed). */
async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: billingEnv().turnstileSecretKey,
          response: token,
        }),
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** true = sous la limite ; false = dépassée ; null = RPC en erreur. */
async function hitRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return null;
  return data === true;
}

/** Violation de l'index unique du préfixe de facturation (candidat suivant). */
function isPrefixConflict(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  if (error.code !== "23505") return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    text.includes("pending_signups_prefix_live_idx") ||
    text.includes("invoice_prefix")
  );
}

export async function POST(request: NextRequest) {
  // Tunnel fermé tant que la configuration billing est incomplète.
  if (!hasBilling()) {
    return Response.json(
      { error: "Le tunnel d'inscription n'est pas encore ouvert." },
      { status: 503 },
    );
  }
  if (!isSameOriginJsonPost(request)) {
    return Response.json({ error: "Requête refusée." }, { status: 403 });
  }
  const supabase = serviceClient();
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

  // Honeypot rempli → réponse factice « OK » (on ne signale rien au bot).
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { website?: unknown }).website === "string" &&
    (body as { website: string }).website.length > 0
  ) {
    return Response.json({ ok: true });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Formulaire invalide.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;
  const billing = billingEnv();

  // Anti-bot : jeton Turnstile vérifié côté Cloudflare (fail-closed).
  if (!(await verifyTurnstile(input.turnstileToken))) {
    return Response.json(
      {
        error:
          "Vérification anti-robot échouée. Rechargez la page et réessayez.",
      },
      { status: 403 },
    );
  }

  // Contrôle d'autorité du mandat SEPA : requis seulement si l'étape est
  // active. Un client qui l'enverrait alors qu'elle est coupée est ignoré ;
  // s'il manque alors qu'elle est active, on refuse.
  if (billing.sepaEnabled && (!input.sepa || input.mandateAccepted !== true)) {
    return Response.json(
      {
        error: "Mandat de prélèvement SEPA requis.",
        issues: [{ path: ["mandateAccepted"], message: "Mandat SEPA requis" }],
      },
      { status: 422 },
    );
  }

  // Plans vendables : MONTHLY fermé tant que le cycle SEPA n'est pas livré.
  if (billing.checkoutPlans === "annual" && input.plan === "MONTHLY") {
    return Response.json(
      {
        error:
          "L'offre mensuelle sera bientôt disponible — choisissez l'offre 12 mois pour démarrer dès aujourd'hui.",
      },
      { status: 422 },
    );
  }

  // Rate-limit : par IP puis par identité (email admin normalisé, hashé).
  const ip = clientIpFrom(request.headers);
  const emailHash = createHash("sha256")
    .update(input.user.email.trim().toLowerCase())
    .digest("hex");

  const ipAllowed = await hitRateLimit(supabase, `checkout:${ip}`, 5, 3600);
  if (ipAllowed === null) {
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }
  if (!ipAllowed) {
    return Response.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 },
    );
  }
  const idAllowed = await hitRateLimit(
    supabase,
    `checkout-id:${emailHash}`,
    3,
    3600,
  );
  if (idAllowed === null) {
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }
  if (!idAllowed) {
    return Response.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 },
    );
  }

  const { cabinet, user, sepa } = input;

  // RPPS contre l'Annuaire Santé — bloquant UNIQUEMENT sur un
  // « introuvable » certain ; panne ou clé absente = on laisse passer.
  if ((await verifyRppsOnline(cabinet.rppsNumber)) === "not_found") {
    return Response.json(
      {
        error: "Numéro RPPS introuvable dans l'Annuaire Santé.",
        issues: [
          {
            path: ["cabinet", "rppsNumber"],
            message:
              "Ce numéro RPPS est introuvable dans l'Annuaire Santé — vérifiez votre saisie.",
          },
        ],
      },
      { status: 422 },
    );
  }

  const amountCents = checkoutAmountCents(input.plan, input.extraCollaborators);
  const reference = newMoneticoReference();
  const nowIso = new Date().toISOString();

  /* --- Mandat SEPA (seulement si l'étape est active) : RUM réservée +
     texte hashé/versionné + payload IBAN chiffré. Coupé → tout reste null,
     aucun numéro RUM consommé, aucun mandat créé au provisioning. */
  let reservedRum: string | null = null;
  let mandateSha: string | null = null;
  let sepaPayloadEnc: string | null = null;
  let mandateAcceptedAt: string | null = null;

  if (billing.sepaEnabled && sepa) {
    const { data: rumData, error: rumError } =
      await supabase.rpc("next_sepa_rum");
    if (rumError || typeof rumData !== "string") {
      return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
    }
    reservedRum = rumData;

    const debtorAddress = `${cabinet.address}, ${cabinet.postalCode} ${cabinet.city}`;
    mandateSha = mandateTextSha256(
      mandateText({
        rum: reservedRum,
        ics: billing.sepaIcs,
        debtorName: cabinet.name,
        accountHolder: sepa.accountHolder,
        debtorAddress,
        ibanMasked: maskIban(sepa.iban),
      }),
    );
    sepaPayloadEnc = encryptSecret(
      JSON.stringify({
        iban: sepa.iban,
        bic: sepa.bic,
        accountHolder: sepa.accountHolder,
        consentAt: nowIso,
      }),
      reference,
    );
    mandateAcceptedAt = nowIso;
  }

  // Secrets chiffrés au repos, liés au dossier (AAD = référence Monetico).
  const id = randomUUID();
  const statusToken = randomBytes(16).toString("hex");
  const passwordEnc = encryptSecret(user.password, reference);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 400);

  /* --- Préfixe de facturation : pour chaque candidat, disponibilité
     dev B (FAIL-CLOSED) puis INSERT — l'index unique partiel tranche
     les courses résiduelles (candidat suivant en cas de violation). */
  const candidates = invoicePrefixCandidates(cabinet.name);
  let invoicePrefix: string | null = null;

  for (const candidate of candidates) {
    let availability;
    try {
      availability = await checkAvailability({
        cabinet: {
          email: cabinet.email,
          siretNumber: cabinet.siretNumber,
          invoicePrefix: candidate,
        },
        user: { email: user.email },
      });
    } catch (err) {
      if (err instanceof ProvisioningUnavailableError) {
        return Response.json(
          {
            error:
              "Notre service d'inscription est momentanément indisponible. Réessayez dans quelques minutes.",
          },
          { status: 502 },
        );
      }
      console.error(
        "[checkout] check-availability :",
        err instanceof Error ? err.message : String(err),
      );
      return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
    }

    if (!availability.available) {
      const onlyPrefix =
        availability.conflicts.length > 0 &&
        availability.conflicts.every((c) => c === "cabinet.invoicePrefix");
      if (onlyPrefix) continue; // candidat suivant
      // Email/SIRET déjà pris : refus GÉNÉRIQUE (anti-énumération).
      return Response.json({ error: GENERIC_CONFLICT }, { status: 409 });
    }

    const { error: insertError } = await supabase.from("pending_signups").insert({
      id,
      root_id: id, // première ligne de la chaîne : root = elle-même
      monetico_reference: reference,
      plan: input.plan,
      extra_collaborators: input.extraCollaborators,
      amount_cents: amountCents,
      currency: "EUR",
      cabinet: {
        name: cabinet.name,
        email: cabinet.email,
        phone: cabinet.phone,
        mobilePhone: cabinet.mobilePhone,
        address: cabinet.address,
        city: cabinet.city,
        postalCode: cabinet.postalCode,
        siretNumber: cabinet.siretNumber,
        rppsNumber: cabinet.rppsNumber,
      },
      user_info: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      invoice_prefix: candidate,
      password_enc: passwordEnc,
      sepa_payload_enc: sepaPayloadEnc,
      reserved_rum: reservedRum,
      mandate_text_version: sepaPayloadEnc ? MANDATE_TEXT_VERSION : null,
      mandate_text_sha256: mandateSha,
      cgv_accepted_at: nowIso,
      mandate_accepted_at: mandateAcceptedAt,
      client_ip: ip,
      user_agent: userAgent,
      status_token: statusToken,
    });

    if (!insertError) {
      invoicePrefix = candidate;
      break;
    }
    if (isPrefixConflict(insertError)) continue; // course : candidat suivant
    console.error("[checkout] insert pending_signups :", insertError.message);
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  if (!invoicePrefix) {
    // Tous les candidats de préfixe sont pris — cas limite improbable.
    return Response.json({ error: GENERIC_CONFLICT }, { status: 409 });
  }

  /* --- Preuve de consentement contractuel (art. 5 CGV v2.1) : libellé
     exact + versions/empreintes des documents + identité + horodatage
     serveur. Table durable, indépendante des purges de pending_signups. */
  const { error: consentError } = await supabase.from("consent_records").insert({
    kind: "contract_terms",
    pending_root_id: id,
    label_text: TERMS_LABEL,
    documents: consentDocumentsSnapshot(),
    accepted_at: nowIso,
    full_name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    client_ip: ip,
    user_agent: userAgent,
  });
  if (consentError) {
    // La preuve est obligatoire : sans elle on n'encaisse pas.
    console.error("[checkout] insert consent_records :", consentError.message);
    await supabase
      .from("pending_signups")
      .update({ status: "abandoned", password_enc: null, sepa_payload_enc: null })
      .eq("id", id);
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  // Formulaire Monetico scellé (auto-submit côté client).
  const siteUrl = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const returnUrl = `${siteUrl}/inscription/confirmation?ref=${reference}`;
  let form;
  try {
    form = buildPaymentForm(
      {
        reference,
        amountCents,
        email: user.email,
        urlRetourOk: returnUrl,
        urlRetourErr: returnUrl,
        billingContext: {
          addressLine1: cabinet.address,
          city: cabinet.city,
          postalCode: cabinet.postalCode,
          country: "FR",
        },
      },
      {
        tpe: billing.moneticoTpe,
        key: billing.moneticoKey,
        societe: billing.moneticoSociete,
        mode: billing.moneticoMode,
      },
    );
  } catch (err) {
    console.error(
      "[checkout] buildPaymentForm :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  await logAudit({
    action: "checkout.created",
    entityType: "pending_signup",
    entityId: id,
    diff: {
      reference,
      plan: input.plan,
      extraCollaborators: input.extraCollaborators,
      amountCents,
      invoicePrefix,
    },
    ip,
    userAgent,
  });

  return Response.json(
    { action: form.action, fields: form.fields, reference },
    { headers: { "set-cookie": checkoutCookie(reference, statusToken) } },
  );
}
