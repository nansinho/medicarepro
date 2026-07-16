import { type NextRequest } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasBilling, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import {
  encryptSecret,
  decryptSecret,
  timingSafeEqualString,
} from "@/lib/crypto";
import { buildPaymentForm } from "@/lib/monetico";
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

/* ============================================================
   POST /api/checkout/retry — nouvelle tentative après un refus
   de paiement. Crée une NOUVELLE ligne pending_signups (nouvelle
   référence Monetico, nouveau RUM, nouveau token) chaînée à
   l'ancienne (root_id hérité, parent_id = ancien dossier), puis
   marque l'ancienne 'superseded'. Les secrets sont RE-chiffrés :
   l'AAD change avec la référence.
   Réponses : même contrat que POST /api/checkout.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_CONFLICT =
  "Ces informations ne permettent pas de créer un compte. Vérifiez vos saisies ou contactez-nous.";

const GENERIC_FAILURE =
  "Une erreur technique est survenue. Réessayez dans quelques minutes.";

const RetrySchema = z.object({
  reference: z
    .string()
    .regex(/^[A-Z0-9]{12}$/, "Référence invalide"),
});

/* Référence Monetico : "MP" + 10 caractères Crockford base32
   (A-Z0-9 sans I, L, O, U). 256 % 32 === 0 : tirage sans biais. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function newMoneticoReference(): string {
  const bytes = randomBytes(10);
  let out = "MP";
  for (let i = 0; i < 10; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

function checkoutCookie(reference: string, statusToken: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `mp_checkout=${reference}.${statusToken}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax${secure}`;
}

/** Violation de l'index unique du préfixe de facturation. */
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

type ContractCabinet = {
  name: string;
  email: string;
  phone: string;
  mobilePhone: string;
  address: string;
  city: string;
  postalCode: string;
  siretNumber?: string;
  rppsNumber: string;
};

type OldRow = {
  id: string;
  root_id: string;
  monetico_reference: string;
  status: string;
  status_token: string;
  plan: "MONTHLY" | "ANNUAL";
  extra_collaborators: number;
  amount_cents: number;
  currency: string;
  cabinet: ContractCabinet;
  user_info: { firstName: string; lastName: string; email: string };
  password_enc: string | null;
  sepa_payload_enc: string | null;
  cgv_accepted_at: string;
  mandate_accepted_at: string;
  client_ip: string | null;
  user_agent: string | null;
};

export async function POST(request: NextRequest) {
  if (!hasBilling()) {
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
  const oldReference = parsed.data.reference;

  // Cookie porteur : même contrôle que /api/checkout/status.
  const cookie = request.cookies.get("mp_checkout")?.value ?? "";
  const dot = cookie.indexOf(".");
  const cookieRef = dot > 0 ? cookie.slice(0, dot) : "";
  const cookieToken = dot > 0 ? cookie.slice(dot + 1) : "";
  if (!cookieRef || !cookieToken || cookieRef !== oldReference) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data: oldData, error: loadError } = await supabase
    .from("pending_signups")
    .select(
      "id, root_id, monetico_reference, status, status_token, plan, extra_collaborators, amount_cents, currency, cabinet, user_info, password_enc, sepa_payload_enc, cgv_accepted_at, mandate_accepted_at, client_ip, user_agent",
    )
    .eq("monetico_reference", oldReference)
    .maybeSingle();
  if (loadError || !oldData) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }
  const old = oldData as OldRow;

  if (!timingSafeEqualString(cookieToken, old.status_token)) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  // Rate-limit : même seau que la création de dossier.
  const ip = clientIpFrom(request.headers);
  const { data: allowed, error: rlError } = await supabase.rpc(
    "hit_rate_limit",
    { p_bucket: `checkout:${ip}`, p_limit: 5, p_window_seconds: 3600 },
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

  // Rejouable UNIQUEMENT depuis un dossier non payé (refus) ou déjà remplacé.
  if (old.status !== "payment_pending" && old.status !== "superseded") {
    return Response.json(
      { error: "Ce dossier ne peut plus être rejoué." },
      { status: 409 },
    );
  }
  // Le mandat SEPA n'est requis que si le dossier d'origine en portait un
  // (créé quand l'étape SEPA était active). Sans SEPA, seul le mot de passe
  // doit être présent.
  const hadSepa = Boolean(old.sepa_payload_enc);
  if (!old.password_enc) {
    // Secrets purgés (dossier trop ancien) : repasser par le formulaire.
    return Response.json(
      { error: "Ce dossier a expiré. Recommencez votre inscription." },
      { status: 409 },
    );
  }

  const billing = billingEnv();
  const cabinet = old.cabinet;
  const user = old.user_info;

  // RE-chiffrement des secrets : l'AAD est la référence Monetico — elle
  // change, donc on déchiffre avec l'ancienne et on rechiffre avec la nouvelle.
  const newReference = newMoneticoReference();
  let passwordEnc: string;
  let sepaPayloadEnc: string | null = null;
  let reservedRum: string | null = null;
  let mandateSha: string | null = null;
  try {
    const password = decryptSecret(old.password_enc, old.monetico_reference);
    passwordEnc = encryptSecret(password, newReference);
    if (hadSepa) {
      const sepaJson = decryptSecret(
        old.sepa_payload_enc!,
        old.monetico_reference,
      );
      const sepaPayload = JSON.parse(sepaJson) as {
        iban: string;
        bic?: string;
        accountHolder: string;
      };
      sepaPayloadEnc = encryptSecret(sepaJson, newReference);

      // Nouveau RUM : le texte du mandat (donc son empreinte) en dépend.
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
          accountHolder: sepaPayload.accountHolder,
          debtorAddress,
          ibanMasked: maskIban(sepaPayload.iban),
        }),
      );
    }
  } catch {
    return Response.json(
      { error: "Ce dossier a expiré. Recommencez votre inscription." },
      { status: 409 },
    );
  }

  const newId = randomUUID();
  const statusToken = randomBytes(16).toString("hex");

  /* --- Re-vérification des disponibilités + INSERT (même logique de
     préfixe que /api/checkout). L'ancien dossier est encore « vivant »
     dans l'index unique : son préfixe sera refusé, le candidat suivant
     prendra le relais. */
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
        "[checkout-retry] check-availability :",
        err instanceof Error ? err.message : String(err),
      );
      return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
    }

    if (!availability.available) {
      const onlyPrefix =
        availability.conflicts.length > 0 &&
        availability.conflicts.every((c) => c === "cabinet.invoicePrefix");
      if (onlyPrefix) continue;
      return Response.json({ error: GENERIC_CONFLICT }, { status: 409 });
    }

    const { error: insertError } = await supabase.from("pending_signups").insert({
      id: newId,
      root_id: old.root_id, // chaîne héritée du premier dossier
      parent_id: old.id,
      monetico_reference: newReference,
      plan: old.plan,
      extra_collaborators: old.extra_collaborators,
      amount_cents: old.amount_cents,
      currency: old.currency,
      cabinet: old.cabinet,
      user_info: old.user_info,
      invoice_prefix: candidate,
      password_enc: passwordEnc,
      sepa_payload_enc: sepaPayloadEnc,
      reserved_rum: reservedRum,
      mandate_text_version: sepaPayloadEnc ? MANDATE_TEXT_VERSION : null,
      mandate_text_sha256: mandateSha,
      // Consentements : ceux réellement donnés au checkout d'origine
      // (l'IP/UA de preuve restent ceux du moment du consentement).
      cgv_accepted_at: old.cgv_accepted_at,
      mandate_accepted_at: old.mandate_accepted_at,
      client_ip: old.client_ip,
      user_agent: old.user_agent,
      status_token: statusToken,
    });

    if (!insertError) {
      invoicePrefix = candidate;
      break;
    }
    if (isPrefixConflict(insertError)) continue;
    console.error(
      "[checkout-retry] insert pending_signups :",
      insertError.message,
    );
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  if (!invoicePrefix) {
    return Response.json({ error: GENERIC_CONFLICT }, { status: 409 });
  }

  // L'ancien dossier est remplacé (seulement s'il attend encore un paiement).
  await supabase
    .from("pending_signups")
    .update({ status: "superseded" })
    .eq("id", old.id)
    .eq("status", "payment_pending");

  const siteUrl = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const returnUrl = `${siteUrl}/inscription/confirmation?ref=${newReference}`;
  let form;
  try {
    form = buildPaymentForm(
      {
        reference: newReference,
        amountCents: old.amount_cents,
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
      "[checkout-retry] buildPaymentForm :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: GENERIC_FAILURE }, { status: 502 });
  }

  await logAudit({
    action: "checkout.retried",
    entityType: "pending_signup",
    entityId: newId,
    diff: {
      reference: newReference,
      parentId: old.id,
      rootId: old.root_id,
      invoicePrefix,
    },
    ip,
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 400),
  });

  return Response.json(
    { action: form.action, fields: form.fields, reference: newReference },
    { headers: { "set-cookie": checkoutCookie(newReference, statusToken) } },
  );
}
