import "server-only";
import { billingEnv } from "@/lib/env";

/* ============================================================
   Client de l'API de provisioning de l'app (contrat dev B).

   - Auth : header x-medicarepro-provision-authorization (clé
     statique), server-to-server UNIQUEMENT.
   - check-availability : AVANT tout encaissement, FAIL-CLOSED
     (erreur réseau → on n'encaisse pas).
   - provision/cabinet : APRÈS confirmation IPN, idempotent sur
     idempotencyKey (= référence Monetico) ; retry ×3 backoff sur
     timeout/5xx ; 409 → JAMAIS rejoué (résolution manuelle).

   ⚠️ RÈGLE ABSOLUE : ne JAMAIS logger le body (mot de passe en
   clair vers l'app), les headers (clé API) ni les réponses
   complètes. Les erreurs ne portent que status + message court.
   ============================================================ */

const CHECK_TIMEOUT_MS = 8_000;
const PROVISION_TIMEOUT_MS = 15_000;
const PROVISION_MAX_ATTEMPTS = 3;

/* ------------------------------------------------------------
   Erreurs typées — l'appelant (worker) route selon le type.
   ------------------------------------------------------------ */

/** 409 : identifiant unique déjà pris. Ne JAMAIS rejouer à l'identique. */
export class ProvisioningConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisioningConflictError";
  }
}

/** 400/401 : bug d'intégration ou clé invalide — pas de retry automatique. */
export class ProvisioningRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProvisioningRequestError";
  }
}

/** Réseau/timeout/5xx après épuisement des retries — replanifiable. */
export class ProvisioningUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisioningUnavailableError";
  }
}

/* ------------------------------------------------------------
   Types du contrat (§5/§6 de la doc dev B).
   ------------------------------------------------------------ */

export type AvailabilityInput = {
  cabinet?: { email?: string; siretNumber?: string; invoicePrefix?: string };
  user?: { email?: string };
};

export type AvailabilityResult = {
  available: boolean;
  conflicts: string[]; // "cabinet.email" | "cabinet.siretNumber" | "cabinet.invoicePrefix" | "user.email"
};

/** Le prestataire, dans la convention du contrat : en MAJUSCULES. */
export type AppPaymentProvider = "MONETICO" | "STRIPE";

/**
 * Traduit notre valeur interne vers celle attendue par l'application.
 *
 * Deux conventions cohabitent, chacune cohérente dans son monde : minuscules
 * chez nous (base, environnement), majuscules dans le contrat. C'est
 * exactement le genre de détail qui produit un refus incompréhensible le jour
 * du premier vrai paiement, d'où une fonction nommée plutôt qu'un
 * `.toUpperCase()` perdu dans un appel.
 *
 * NULL vaut MONETICO : c'est le cas des lignes antérieures à la migration
 * 0034, toutes encaissées par Monetico.
 */
export function providerForApp(
  interne: "monetico" | "stripe" | null | undefined,
): AppPaymentProvider {
  return interne === "stripe" ? "STRIPE" : "MONETICO";
}

export type ProvisionPayload = {
  idempotencyKey: string; // = référence Monetico
  cabinet: {
    name: string;
    email: string;
    phone?: string;
    mobilePhone: string;
    address: string;
    city: string;
    postalCode: string;
    siretNumber?: string;
    rppsNumber?: string;
    invoicePrefix: string;
  };
  user: {
    firstName: string;
    lastName: string;
    email: string;
    password: string; // choisi au checkout — JAMAIS loggé, JAMAIS stocké en clair
  };
  plan: "MONTHLY" | "ANNUAL";
  extraCollaborators: number;
  payment: {
    /* MAJUSCULES : c'est la convention du contrat avec l'application métier,
       depuis toujours. Chez nous la même notion s'écrit en minuscules
       (colonne payment_provider, variable PAYMENT_PROVIDER) — d'où la
       conversion explicite de providerForApp(), et son test.

       À ENVOYER TOUJOURS. Confirmé par l'équipe de l'application le
       05/08/2026 : le champ n'est pas une énumération stricte de leur côté,
       mais une valeur ABSENTE est enregistrée « MONETICO » par défaut. Un
       paiement Stripe muet serait donc comptabilisé chez eux comme un
       paiement Monetico. */
    provider: AppPaymentProvider;
    reference: string;
    amount: number; // centimes
    currency: string;
    paidAt: string; // ISO 8601
  };
};

export type ProvisionResult = {
  alreadyProvisioned: boolean;
  cabinetId: string;
  userId: string;
  loginUrl: string;
};

/* ------------------------------------------------------------
   Contrat cabinet — SOURCE UNIQUE de la correspondance
   « dossier checkout → payload de provisioning ».

   L'app valide ces champs à la création du compte, APRÈS
   encaissement : si l'un part vide, le compte échoue en 400 et
   le client a payé pour rien. Ils DOIVENT donc tous être garantis
   non vides côté tunnel. Le test provisioning-contract.test.ts
   échoue si ce n'est plus le cas — c'est le garde-fou.

   Historique des découvertes en prod (chaque champ ajouté ici
   après un vrai client bloqué) :
   - rppsNumber : exigé (a931950)
   - phone      : exigé — repli sur le portable (7411db3)
   ------------------------------------------------------------ */

/** Champs cabinet que l'app EXIGE non vides. */
export const APP_REQUIRED_CABINET_FIELDS = [
  "name",
  "email",
  "phone",
  "mobilePhone",
  "address",
  "city",
  "postalCode",
  "siretNumber",
  "rppsNumber",
  "invoicePrefix",
] as const;

export type CabinetInput = {
  name: string;
  email: string;
  phone?: string;
  mobilePhone: string;
  address: string;
  city: string;
  postalCode: string;
  siretNumber?: string;
  rppsNumber?: string;
};

/**
 * Construit le bloc cabinet du payload de provisioning.
 * Repli téléphone : l'app exige `phone`, mais le tunnel laisse le fixe
 * facultatif (beaucoup de praticiens n'ont qu'un portable) — on envoie
 * donc le portable quand le fixe est vide, l'app reçoit toujours un numéro.
 */
export function buildProvisioningCabinet(
  cabinet: CabinetInput,
  invoicePrefix: string,
): ProvisionPayload["cabinet"] {
  return {
    name: cabinet.name,
    email: cabinet.email,
    phone: cabinet.phone || cabinet.mobilePhone,
    mobilePhone: cabinet.mobilePhone,
    address: cabinet.address,
    city: cabinet.city,
    postalCode: cabinet.postalCode,
    siretNumber: cabinet.siretNumber,
    rppsNumber: cabinet.rppsNumber,
    invoicePrefix,
  };
}

/* ------------------------------------------------------------
   Transport.
   ------------------------------------------------------------ */

type Envelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

async function post<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<{ status: number; envelope: Envelope<T> | null }> {
  const { provisioningApiUrl, provisioningApiKey } = billingEnv();
  const url = `${provisioningApiUrl.replace(/\/$/, "")}${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-medicarepro-provision-authorization": provisioningApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    // Corps non-JSON (proxy, 502 HTML…) : traité par le status seul.
  }
  return { status: response.status, envelope };
}

/* ------------------------------------------------------------
   check-availability — FAIL-CLOSED.
   ------------------------------------------------------------ */

export async function checkAvailability(
  input: AvailabilityInput,
): Promise<AvailabilityResult> {
  let status: number;
  let envelope: Envelope<AvailabilityResult> | null;
  try {
    ({ status, envelope } = await post<AvailabilityResult>(
      "/check-availability",
      input,
      CHECK_TIMEOUT_MS,
    ));
  } catch {
    // Réseau/timeout : on N'ENCAISSE PAS sans pré-contrôle.
    throw new ProvisioningUnavailableError(
      "check-availability injoignable — encaissement refusé (fail-closed).",
    );
  }

  if (status === 401) {
    throw new ProvisioningRequestError(401, "Clé de provisioning refusée.");
  }
  if (status >= 500 || !envelope || !envelope.success) {
    throw new ProvisioningUnavailableError(
      `check-availability en erreur (HTTP ${status}).`,
    );
  }
  return envelope.data;
}

/* ------------------------------------------------------------
   provision/cabinet — idempotent, retry ×3 backoff+jitter.
   ------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function provisionCabinet(
  payload: ProvisionPayload,
): Promise<ProvisionResult> {
  let lastError = "";

  for (let attempt = 1; attempt <= PROVISION_MAX_ATTEMPTS; attempt++) {
    let status: number;
    let envelope: Envelope<ProvisionResult> | null;

    try {
      ({ status, envelope } = await post<ProvisionResult>(
        "/cabinet",
        payload,
        PROVISION_TIMEOUT_MS,
      ));
    } catch {
      lastError = "réseau/timeout";
      if (attempt < PROVISION_MAX_ATTEMPTS) {
        await sleep(500 * attempt + Math.floor(Math.random() * 250));
        continue;
      }
      break;
    }

    // 200 (idempotent) et 201 (créé) = succès équivalents.
    if ((status === 200 || status === 201) && envelope?.success) {
      return envelope.data;
    }

    if (status === 409) {
      throw new ProvisioningConflictError(
        envelope && !envelope.success ? envelope.error : "Conflit d'unicité (409).",
      );
    }
    if (status === 400 || status === 401) {
      throw new ProvisioningRequestError(
        status,
        envelope && !envelope.success
          ? envelope.error
          : `Requête refusée (HTTP ${status}).`,
      );
    }

    // 5xx (ou enveloppe illisible) : retry avec la même idempotencyKey.
    lastError = `HTTP ${status}`;
    if (attempt < PROVISION_MAX_ATTEMPTS) {
      await sleep(500 * attempt + Math.floor(Math.random() * 250));
    }
  }

  throw new ProvisioningUnavailableError(
    `provision/cabinet indisponible après ${PROVISION_MAX_ATTEMPTS} tentatives (${lastError}).`,
  );
}

/* ------------------------------------------------------------
   subscription/state — remontée de l'état de l'abonnement.

   POURQUOI : la vitrine est la source de vérité de la facturation
   et prolonge `subscriptions.current_period_end` dans SA base.
   L'app, elle, calculait `subscriptionExpiresAt` une seule fois,
   au provisioning (achat + 1 mois ou + 1 an) et ne la bougeait
   plus : le praticien y voyait une échéance périmée dès sa
   deuxième période, et le cron d'alerte de l'app prévenait les
   super-admins pour rien.

   UNE SEULE ROUTE POUR TOUS LES MOUVEMENTS : première souscription
   d'un cabinet existant, reconduction, changement de formule,
   résiliation, suspension pour impayé. Le contrat initialement
   demandé (`/subscription/renewal`, docs/provisioning-renewal.md)
   ne couvrait que la reconduction : trop étroit pour le cycle de
   vie réel. Contrat à jour : docs/provisioning-subscription-state.md.

   Tant que PROVISIONING_RENEWAL_ENABLED n'est pas à `true`,
   l'appel est un no-op silencieux.

   BEST-EFFORT : ne jette jamais. Un encaissement ne doit pas
   échouer parce que l'app d'en face est indisponible ; l'appelant
   journalise et l'état reste rattrapable à la main.
   ------------------------------------------------------------ */

const RENEWAL_TIMEOUT_MS = 10_000;
const RENEWAL_MAX_ATTEMPTS = 2;

/** États d'abonnement compris par l'app (enum SubscriptionStatus). */
export type AppSubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELED"
  | "EXPIRED";

export type RenewalPayload = {
  /** Idempotence PAR MOUVEMENT : `MPXXX-r3`, `MPXXX-attach`… Jamais la seule
      référence : le TPE récurrent la rejoue à chaque échéance. */
  idempotencyKey: string;
  /** Identifiant du cabinet DANS l'app, renvoyé par le provisioning initial. */
  cabinetId: string;
  plan: "MONTHLY" | "ANNUAL";
  /* Tout ce qui suit décrit un ENCAISSEMENT : absent quand l'événement n'en
     est pas un (impayé, résiliation), ce qui laisse l'app conserver la
     dernière échéance connue au lieu de la voir reculer. */
  /** Nouvelle fin de période, telle que calculée par la vitrine (ISO 8601). */
  periodEnd?: string;
  /** Date d'encaissement notifiée par Monetico (ISO 8601). */
  paidAt?: string;
  amountCents?: number;
  currency?: string;
  /** Défaut ACTIVE : la très grande majorité des appels suit un encaissement. */
  status?: AppSubscriptionStatus;
  /** Sièges facturés, pour aligner le quota de l'app sur ce qui est payé. */
  maxAssistants?: number;
  /** Résiliation demandée : l'accès court jusqu'à l'échéance. */
  cancelAtPeriodEnd?: boolean;
  /** Impayé : accès entier jusqu'à cette date, lecture seule au-delà. */
  graceUntil?: string;
};

export type RenewalOutcome =
  | { ok: true; skipped: true } // route désactivée : rien n'a été tenté
  | { ok: true; skipped: false }
  | { ok: false; reason: string };

export async function notifyRenewal(
  payload: RenewalPayload,
): Promise<RenewalOutcome> {
  if (!billingEnv().provisioningRenewalEnabled) {
    return { ok: true, skipped: true };
  }

  /* Un appel qui suit un encaissement décrit un abonnement à jour : c'est le
     cas de loin le plus fréquent, on ne force pas chaque appelant à le
     répéter. Les états d'exception (impayé, résiliation) sont, eux, toujours
     passés explicitement. */
  const body = { status: "ACTIVE" as AppSubscriptionStatus, ...payload };

  let lastError = "";
  for (let attempt = 1; attempt <= RENEWAL_MAX_ATTEMPTS; attempt++) {
    try {
      const { status, envelope } = await post<{ subscriptionExpiresAt: string }>(
        "/subscription/state",
        body,
        RENEWAL_TIMEOUT_MS,
      );
      // 200 = appliqué ou déjà appliqué (idempotent sur idempotencyKey).
      if (status === 200 && envelope?.success) return { ok: true, skipped: false };
      if (status === 400 || status === 401 || status === 404) {
        // Bug d'intégration, clé refusée ou cabinet inconnu : pas de retry.
        return {
          ok: false,
          reason:
            envelope && !envelope.success
              ? `HTTP ${status} — ${envelope.error}`
              : `HTTP ${status}`,
        };
      }
      lastError = `HTTP ${status}`;
    } catch {
      lastError = "réseau/timeout";
    }
    if (attempt < RENEWAL_MAX_ATTEMPTS) {
      await sleep(400 * attempt + Math.floor(Math.random() * 200));
    }
  }
  return { ok: false, reason: lastError };
}

/* ------------------------------------------------------------
   cabinet — recherche d'un cabinet existant (réconciliation).

   POURQUOI C'EST ARRIVÉ TARD : cette route n'existait pas côté app quand
   l'écran de souscription a été construit. Il fallait donc coller à la main
   l'identifiant du cabinet, relevé dans le back-office de l'application —
   au mieux fastidieux, au pire source d'erreur : un identifiant faux
   rattache l'abonnement, et donc le prélèvement, au mauvais cabinet.

   La recherche est en LECTURE SEULE et ne renvoie aucune donnée patient.
   Elle sert à pré-remplir la facturation, jamais à décider d'un prix.
   ------------------------------------------------------------ */

const LOOKUP_TIMEOUT_MS = 8_000;

export type CabinetLookupResult = {
  id: string;
  name: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  siretNumber: string | null;
  invoicePrefix: string;
  status: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  maxAssistants: number | null;
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type CabinetLookupOutcome =
  | { ok: true; cabinet: CabinetLookupResult }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; reason: string };

/** Recherche par email OU par identifiant. Ne jette jamais. */
export async function lookupCabinet(input: {
  email?: string;
  id?: string;
}): Promise<CabinetLookupOutcome> {
  const { provisioningApiUrl, provisioningApiKey } = billingEnv();
  const params = new URLSearchParams();
  if (input.id) params.set("id", input.id);
  else if (input.email) params.set("email", input.email);
  else return { ok: false, notFound: false, reason: "Aucun critère fourni." };

  const url = `${provisioningApiUrl.replace(/\/$/, "")}/cabinet?${params}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "x-medicarepro-provision-authorization": provisioningApiKey },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      notFound: false,
      reason: "L'application est injoignable.",
    };
  }

  if (response.status === 404) return { ok: false, notFound: true };
  if (response.status === 401) {
    return { ok: false, notFound: false, reason: "Clé de provisioning refusée." };
  }

  let envelope: Envelope<CabinetLookupResult> | null = null;
  try {
    envelope = (await response.json()) as Envelope<CabinetLookupResult>;
  } catch {
    envelope = null;
  }
  if (!response.ok || !envelope || !envelope.success) {
    return {
      ok: false,
      notFound: false,
      reason: `Recherche en erreur (HTTP ${response.status}).`,
    };
  }
  return { ok: true, cabinet: envelope.data };
}
