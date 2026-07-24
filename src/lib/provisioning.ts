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
    provider: "MONETICO";
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
