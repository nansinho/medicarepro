import { z } from "zod";

/* ============================================================
   Environnement serveur, validé à la demande.
   La Phase 1 fonctionne SANS Supabase : tout ce qui touche à la
   base est optionnel — les fetchers CMS retombent alors sur le
   contenu embarqué (src/lib/cms/fallback.ts).
   Les NEXT_PUBLIC_* restent lues directement là où le bundler
   doit les inliner côté client.
   ============================================================ */

const EnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("https://medicarepro.fr"),
  NEXT_PUBLIC_APP_URL: z.url().default("https://app.medicarepro.fr"),

  /* Supabase (optionnel tant que la base n'est pas provisionnée) */
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  /* Secrets applicatifs (phases ultérieures) */
  CRON_SECRET: z.string().min(16).optional(),
  DRAFT_PREVIEW_SECRET: z.string().min(16).optional(),

  /* IA (pipeline articles/villes) */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),

  /* Google Search Console */
  GSC_SITE_URL: z.string().min(1).optional(),
  GSC_SERVICE_ACCOUNT_KEY_B64: z.string().min(1).optional(),

  /* Email transactionnel (formulaire de contact, notifications) */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /* Adresse expéditrice (From) — le SMTP doit être autorisé à l'émettre. */
  SMTP_FROM: z.string().default("noreply@medicarepro.fr"),
  /* Destinataire des demandes du formulaire de contact. */
  CONTACT_TO: z.string().default("contact@medicarepro.fr"),

  /* --- Billing (tunnel d'inscription payante) ---------------------------
     Optionnels au boot du site vitrine ; billingEnv() les EXIGE tous —
     le tunnel /inscription refuse de s'ouvrir tant qu'ils manquent. */

  /* Monetico classique (paiement carte one-shot).
     Deux clés peuvent cohabiter en permanence : MONETICO_KEY_TEST et
     MONETICO_KEY_PROD. Le site prend celle qui correspond à MONETICO_MODE,
     donc basculer test↔production = changer seulement MONETICO_MODE.
     MONETICO_KEY (legacy, sans suffixe) reste acceptée en repli pour ne
     rien casser pendant la transition. */
  MONETICO_TPE: z.string().min(1).optional(),
  MONETICO_KEY: z
    .string()
    .regex(/^[0-9A-Za-z]{40}$/, "clé Monetico : 40 caractères attendus")
    .optional(),
  MONETICO_KEY_TEST: z
    .string()
    .regex(/^[0-9A-Za-z]{40}$/, "clé Monetico test : 40 caractères attendus")
    .optional(),
  MONETICO_KEY_PROD: z
    .string()
    .regex(/^[0-9A-Za-z]{40}$/, "clé Monetico production : 40 caractères attendus")
    .optional(),
  MONETICO_SOCIETE: z.string().min(1).optional(),
  MONETICO_MODE: z.enum(["test", "production"]).default("test"),

  /* API de provisioning de l'app (contrat dev B) */
  PROVISIONING_API_URL: z.url().optional(),
  PROVISIONING_API_KEY: z.string().min(1).optional(),

  /* Chiffrement des secrets au repos (cf. src/lib/crypto.ts) */
  ENCRYPTION_KEYS: z.string().min(1).optional(),
  ENCRYPTION_ACTIVE_KEY_ID: z.string().default("v1"),

  /* SEPA (mandats Core + prélèvements CIC) */
  SEPA_ICS: z.string().min(1).optional(), // Identifiant Créancier SEPA — à demander au CIC
  SEPA_PRENOTIFY_DAYS: z.coerce
    .number()
    .min(14, "pré-notification SEPA : 14 jours calendaires minimum (légal)")
    .default(14),

  /* Alertes internes billing (incidents, synchro, remises) */
  BILLING_ALERTS_TO: z.string().default("contact@medicarepro.fr"),

  /* Cloudflare Turnstile (anti-bot du checkout) */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  /* Nombre de proxys de confiance devant l'app (Traefik/Coolify = 1) */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  /* Plans vendables : 'annual' tant que le cycle SEPA (BILLING-2)
     n'est pas livré — une échéance MONTHLY arrive à J+30. */
  CHECKOUT_PLANS: z.enum(["annual", "all"]).default("annual"),

  /* Étape « Mandat SEPA » du tunnel. Coupée par défaut (renouvellements
     par empreinte carte à confirmer avec le CIC) : l'étape 4 disparaît,
     aucun mandat/RUM n'est créé, et SEPA_ICS n'est plus exigé. Repasser
     à `true` réactive tout le circuit SEPA sans autre changement. */
  CHECKOUT_SEPA_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Écarte les variables vides avant validation : dans un fichier `.env`,
 * une clé sans valeur (`FOO=`) est lue comme la chaîne `""` et non comme
 * `undefined` — ce qui ferait échouer les `.optional()`/`.default()`.
 * On les convertit donc en `undefined` pour que « vide » = « absent ».
 */
function withoutEmptyStrings(
  source: NodeJS.ProcessEnv,
): Record<string, string | undefined> {
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    cleaned[key] = value === "" ? undefined : value;
  }
  return cleaned;
}

/** Env validée (mise en cache). Lève une erreur lisible si invalide. */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(withoutEmptyStrings(process.env));
    if (!parsed.success) {
      throw new Error(
        `Variables d'environnement invalides : ${parsed.error.issues
          .map((i) => `${i.path.join(".")} (${i.message})`)
          .join(", ")}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}

/** Supabase est-il configuré ? (sinon : fallback contenu embarqué) */
export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Le SMTP est-il configuré ? (sinon : l'envoi d'email est désactivé) */
export function hasSmtp(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/* ============================================================
   Billing — sous-ensemble STRICT exigé par le tunnel /inscription.
   On n'encaisse JAMAIS un client à qui on ne peut pas créer de
   mandat (SEPA_ICS) ni chiffrer les secrets (ENCRYPTION_KEYS) ni
   provisionner le compte (PROVISIONING_*) — arbitrage A30.
   ============================================================ */

const BILLING_REQUIRED = [
  "MONETICO_TPE",
  "MONETICO_SOCIETE",
  "PROVISIONING_API_URL",
  "PROVISIONING_API_KEY",
  "ENCRYPTION_KEYS",
  "TURNSTILE_SECRET_KEY",
] as const;

/**
 * Clé Monetico effective pour le mode courant : la clé spécifique au mode
 * (MONETICO_KEY_TEST/PROD) l'emporte ; à défaut, MONETICO_KEY (legacy).
 * Renvoie undefined si aucune clé utilisable n'est configurée.
 */
export function moneticoKeyForMode(e: Env): string | undefined {
  const specific =
    e.MONETICO_MODE === "production" ? e.MONETICO_KEY_PROD : e.MONETICO_KEY_TEST;
  return specific ?? e.MONETICO_KEY;
}

/** Variables billing manquantes ([] si tout est prêt). */
export function missingBillingEnv(): string[] {
  const e = env();
  const required = [...BILLING_REQUIRED];
  // SEPA_ICS n'est indispensable que si l'étape mandat SEPA est active.
  if (e.CHECKOUT_SEPA_ENABLED) required.push("SEPA_ICS" as never);
  const missing = required.filter(
    (key) => !e[key as keyof Env],
  ) as unknown as string[];
  // Clé Monetico du mode courant : nommée selon le mode manquant si absente.
  if (!moneticoKeyForMode(e)) {
    missing.push(
      e.MONETICO_MODE === "production" ? "MONETICO_KEY_PROD" : "MONETICO_KEY_TEST",
    );
  }
  return missing;
}

/** Le tunnel d'inscription peut-il s'ouvrir ? */
export function hasBilling(): boolean {
  return missingBillingEnv().length === 0;
}

export type BillingEnv = {
  moneticoTpe: string;
  moneticoKey: string;
  moneticoSociete: string;
  moneticoMode: "test" | "production";
  provisioningApiUrl: string;
  provisioningApiKey: string;
  /** ICS créancier — chaîne vide si l'étape SEPA est coupée. */
  sepaIcs: string;
  sepaPrenotifyDays: number;
  /** Étape mandat SEPA active dans le tunnel ? */
  sepaEnabled: boolean;
  billingAlertsTo: string;
  turnstileSecretKey: string;
  checkoutPlans: "annual" | "all";
};

/**
 * Env billing STRICTE — jette avec la liste des manquants si incomplète.
 * À n'appeler que depuis les routes/pages du tunnel et les crons billing.
 */
export function billingEnv(): BillingEnv {
  const missing = missingBillingEnv();
  if (missing.length > 0) {
    throw new Error(
      `Configuration billing incomplète : ${missing.join(", ")} manquant(s).`,
    );
  }
  const e = env();
  return {
    moneticoTpe: e.MONETICO_TPE!,
    moneticoKey: moneticoKeyForMode(e)!,
    moneticoSociete: e.MONETICO_SOCIETE!,
    moneticoMode: e.MONETICO_MODE,
    provisioningApiUrl: e.PROVISIONING_API_URL!,
    provisioningApiKey: e.PROVISIONING_API_KEY!,
    sepaIcs: e.SEPA_ICS ?? "",
    sepaPrenotifyDays: e.SEPA_PRENOTIFY_DAYS,
    sepaEnabled: e.CHECKOUT_SEPA_ENABLED,
    billingAlertsTo: e.BILLING_ALERTS_TO,
    turnstileSecretKey: e.TURNSTILE_SECRET_KEY!,
    checkoutPlans: e.CHECKOUT_PLANS,
  };
}
