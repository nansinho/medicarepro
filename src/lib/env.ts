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

  /* Paiement IMMÉDIAT (TPE NB8179I) — offre annuelle en paiement unique.
     L'annuel n'est PAS reconduit par carte : il est vendu one-shot sur ce
     TPE (qui encaisse automatiquement), puis renouvelé sur rappel côté app.
     Exigé seulement si CHECKOUT_PLANS ouvre l'annuel (cf. missingBillingEnv).
     Le mensuel, lui, reste sur le TPE récurrent ci-dessus. */
  MONETICO_TPE_IMMEDIATE: z.string().min(1).optional(),
  MONETICO_KEY_IMMEDIATE_TEST: z
    .string()
    .regex(/^[0-9A-Za-z]{40}$/, "clé Monetico immédiat test : 40 caractères attendus")
    .optional(),
  MONETICO_KEY_IMMEDIATE_PROD: z
    .string()
    .regex(/^[0-9A-Za-z]{40}$/, "clé Monetico immédiat prod : 40 caractères attendus")
    .optional(),
  MONETICO_SOCIETE_IMMEDIATE: z.string().min(1).optional(),

  /* API de provisioning de l'app (contrat dev B) */
  PROVISIONING_API_URL: z.url().optional(),
  PROVISIONING_API_KEY: z.string().min(1).optional(),
  /* Remontée des reconductions vers l'app (POST /subscription/renewal).
     À `false` tant que dev B n'a pas livré la route : sans elle, la date
     d'échéance affichée dans l'app reste celle du premier achat. Voir
     `docs/provisioning-renewal.md` (contrat demandé) et
     `notifyRenewal()` dans src/lib/provisioning.ts. */
  PROVISIONING_RENEWAL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

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

  /* ---------- Stripe ----------
     Le prestataire d'encaissement retenu le 05/08/2026, après qu'aucun paiement
     réel n'ait jamais abouti chez Monetico : le TPE « Paiement Récurrent »
     n'authentifie pas en 3D Secure (doc §1.5.3/§1.5.4), et depuis la DSP2 les
     émetteurs français refusent le non-authentifié.

     Aucune variable de MODE ici, volontairement : Stripe porte le mode dans la
     clé (`sk_test_` ou `sk_live_`). On le LIT au lieu de le déclarer, parce
     qu'une déclaration peut mentir — MONETICO_MODE affirmait « production »
     pendant que les commandes vivaient sur la plateforme d'essai. */
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_[A-Za-z0-9]+$/, "Clé secrète Stripe invalide")
    .optional(),
  /* Signature des notifications entrantes. Sans elle, le webhook refuse tout :
     un événement non signé peut être fabriqué par n'importe qui. */
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_[A-Za-z0-9+/=]+$/, "Secret de webhook Stripe invalide")
    .optional(),
  /* Identifiants de prix, créés dans le tableau de bord Stripe. Le montant
     facturé vient de LÀ, jamais du navigateur ni de notre grille : celle-ci
     ne sert plus qu'à afficher. */
  STRIPE_PRICE_MONTHLY: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_ANNUAL: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_COLLABORATOR_MONTHLY: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_COLLABORATOR_ANNUAL: z.string().startsWith("price_").optional(),

  /* Qui encaisse. Ferme les routes de l'autre prestataire au lieu de les
     laisser joignables : un chemin de paiement oublié mais atteignable est
     exactement ce qui produit un débit qu'on ne sait plus arrêter. */
  PAYMENT_PROVIDER: z.enum(["monetico", "stripe"]).default("monetico"),

  /* Cloudflare Turnstile (anti-bot du checkout) */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  /* Nombre de proxys de confiance devant l'app (Traefik/Coolify = 1) */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  /* Plans vendables. La fréquence de reconduction est portée par le CODE
     SITE Monetico (champ `societe`), pas par la commande : un code site =
     une fréquence. Tant qu'il n'y en a qu'un, une seule formule peut être
     vendue, sinon le client serait débité au mauvais rythme (une offre
     12 mois sur un code site mensuel = 298,08 € prélevés chaque mois).
     'all' n'est légitime qu'avec un code site par formule. */
  CHECKOUT_PLANS: z.enum(["annual", "monthly", "all"]).default("annual"),

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

/**
 * Clé du TPE IMMÉDIAT pour le mode courant. Monetico délivre UNE seule clé
 * par société, partagée par tous les TPE (mail CIC) : à défaut d'une clé
 * immédiate dédiée, on reprend donc celle du TPE récurrent. Les variables
 * MONETICO_KEY_IMMEDIATE_* ne servent que si un jour un TPE a sa propre clé.
 */
export function moneticoKeyForModeImmediate(e: Env): string | undefined {
  const specific =
    e.MONETICO_MODE === "production"
      ? e.MONETICO_KEY_IMMEDIATE_PROD
      : e.MONETICO_KEY_IMMEDIATE_TEST;
  return specific ?? moneticoKeyForMode(e);
}

/**
 * Clés d'une plateforme DONNÉE, indépendamment de MONETICO_MODE.
 *
 * Pourquoi ce doublon : `moneticoKeyForMode` répond « quelle clé pour ÉMETTRE
 * maintenant », ce qui est juste. Mais pour VÉRIFIER un sceau reçu, la question
 * est autre : la notification vient de la plateforme où vit la commande, qui
 * n'est pas forcément celle configurée aujourd'hui. Le numéro de TPE ne les
 * distingue pas (il est identique en test et en production), donc le sceau est
 * le seul discriminant. Il faut pouvoir l'essayer avec les deux clés.
 */
export function moneticoKeysOfPlatform(
  e: Env,
  mode: "test" | "production",
): { recurrent?: string; immediate?: string } {
  const recurrent =
    (mode === "production" ? e.MONETICO_KEY_PROD : e.MONETICO_KEY_TEST) ??
    e.MONETICO_KEY;
  const immediate =
    (mode === "production"
      ? e.MONETICO_KEY_IMMEDIATE_PROD
      : e.MONETICO_KEY_IMMEDIATE_TEST) ?? recurrent;
  return { recurrent, immediate };
}

/** L'offre annuelle est-elle vendable (donc le TPE immédiat requis) ? */
function annualSellable(e: Env): boolean {
  return e.CHECKOUT_PLANS === "all" || e.CHECKOUT_PLANS === "annual";
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
  // Vendre l'annuel EXIGE de savoir sur QUEL TPE l'encaisser (NB8179I). La
  // clé est partagée par toute la société : elle retombe automatiquement sur
  // celle du récurrent. Le CODE SITE, lui, est exigé par missingCheckoutEnv().
  if (annualSellable(e) && !e.MONETICO_TPE_IMMEDIATE) {
    missing.push("MONETICO_TPE_IMMEDIATE");
  }
  return missing;
}

/**
 * Variables exigées EN PLUS pour ENCAISSER (tunnel, renouvellement, portail).
 *
 * POURQUOI CETTE SÉPARATION : `missingBillingEnv()` garde l'interface Retour
 * (IPN) opérationnelle — une notification doit toujours pouvoir être acquittée,
 * même si la configuration de VENTE est incomplète. Ce qui suit ne ferme donc
 * que la caisse, jamais le journal.
 *
 * MONETICO_SOCIETE_IMMEDIATE : la documentation du projet se contredit sur le
 * paramètre qui porte la FRÉQUENCE de reconduction. `.env.example` (bloc
 * « Plans vendables ») affirme que c'est le CODE SITE (`medicarepr` =
 * « Tous les mois ») ; le bloc « Paiement IMMÉDIAT » affirme que le code site
 * est commun à tous les TPE et que seul le numéro de TPE compte. Si la
 * première version est la bonne, une offre 12 mois émise avec le code site
 * mensuel est prélevée 298,08 € CHAQUE MOIS.
 *
 * Tant que le CIC n'a pas tranché, on refuse le repli SILENCIEUX : dès que
 * l'annuel est vendable, l'exploitant DOIT déclarer explicitement le code site
 * du TPE immédiat. Y remettre la même valeur reste permis — mais devient une
 * décision consciente, tracée dans l'environnement, au lieu d'un défaut.
 */
export function missingCheckoutEnv(): string[] {
  const missing = missingBillingEnv();
  const e = env();
  if (annualSellable(e) && !e.MONETICO_SOCIETE_IMMEDIATE) {
    missing.push("MONETICO_SOCIETE_IMMEDIATE");
  }
  return missing;
}

/**
 * Anomalies de configuration d'encaissement, à AFFICHER dans le back-office.
 * Ce ne sont pas des erreurs bloquantes (la vente continue), mais des
 * situations où l'argent peut partir au mauvais rythme. Aucune valeur
 * secrète n'est renvoyée, seulement des noms de variables et un constat.
 */
export function billingConfigWarnings(): string[] {
  const e = env();
  const warnings: string[] = [];

  /* Deux formules vendues sur un seul code site. Sous la doctrine
     « un code site = une fréquence » (.env.example, bloc « Plans vendables »),
     c'est impossible : l'une des deux formules sera prélevée au rythme de
     l'autre. Sous l'autre doctrine du même fichier (la fréquence suit le TPE),
     c'est parfaitement normal. Tant que le CIC n'a pas tranché, on le signale
     au lieu de choisir à sa place. */
  if (
    e.CHECKOUT_PLANS === "all" &&
    e.MONETICO_SOCIETE_IMMEDIATE &&
    e.MONETICO_SOCIETE &&
    e.MONETICO_SOCIETE_IMMEDIATE === e.MONETICO_SOCIETE
  ) {
    warnings.push(
      "Les deux formules sont vendues, mais le TPE récurrent et le TPE immédiat partagent le même code site Monetico. Si la fréquence de reconduction est portée par le code site, l'offre 12 mois est prélevée au rythme du mensuel. À confirmer auprès du CIC avant de vendre l'annuel.",
    );
  }

  /* Turnstile en clés de démonstration. Cloudflare en publie une poignée, de
     forme « 1x000…AA » : elles laissent TOUT passer, et affichent au visiteur
     « À des fins de test uniquement. Si vous le voyez, signalez-le au
     propriétaire du site. » Vu en production le 05/08/2026, en bas du
     récapitulatif de commande, juste au-dessus du bouton de paiement.
     Deux dégâts, pas un : la protection anti-robot du tunnel n'existe pas, et
     le client lit un avertissement rouge au moment de sortir sa carte. */
  if (usesTurnstileDemoKeys()) {
    warnings.push(
      "Cloudflare Turnstile tourne avec les clés de démonstration : la protection anti-robot du tunnel laisse tout passer, et un bandeau rouge « à des fins de test uniquement » s'affiche au client avant le paiement. Créer un widget pour medicarepro.fr dans le tableau de bord Cloudflare, puis renseigner NEXT_PUBLIC_TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY.",
    );
  }

  return warnings;
}

/**
 * Les clés Turnstile sont-elles celles de démonstration publiées par
 * Cloudflare ? Elles partagent toutes la même forme : un chiffre, « x », puis
 * une longue file de zéros. Les reconnaître par cette forme plutôt que par une
 * liste figée évite de rater celle que Cloudflare ajoutera demain.
 */
export function usesTurnstileDemoKeys(): boolean {
  const e = env();
  const demo = /^[0-9]x0{16,}/i;
  return (
    demo.test(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") ||
    demo.test(e.TURNSTILE_SECRET_KEY ?? "")
  );
}

/**
 * Le site encaisse-t-il en MODE TEST alors qu'il est en ligne pour de vrai ?
 *
 * CE QUE ÇA A COÛTÉ, LE 05/08/2026 : un praticien a tenté quatre fois de régler
 * son offre 12 mois (478,08 €) et s'est fait refuser à chaque essai, motif
 * bancaire « Interdit ». La configuration était bonne à un détail près :
 * MONETICO_MODE valait `test`, donc les cartes partaient sur
 * `p.monetico-services.com/test/paiement.cgi`, où AUCUNE carte réelle n'est
 * acceptée. Rien, nulle part, ne le signalait — ni dans le back office, ni
 * dans le tunnel. Le client est parti, et personne ne l'a su avant qu'il ne le
 * dise.
 *
 * D'où cette fonction, et les bandeaux qu'elle allume. Le mode test est
 * parfaitement légitime ; ce qui ne l'est pas, c'est qu'il soit invisible.
 *
 * La détection croise DEUX signaux, parce qu'aucun ne suffit seul :
 * `NODE_ENV=production` vaut aussi pour un `next start` local, et une URL
 * publique ne dit rien du mode. Ensemble, ils ne laissent passer que le cas
 * qui fait perdre des clients : un site servi sur son vrai domaine et une
 * caisse branchée sur la plateforme d'essai.
 */
export function paymentsInTestModeOnLiveSite(): boolean {
  const e = env();
  if (e.MONETICO_MODE !== "test") return false;
  if (process.env.NODE_ENV !== "production") return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(
    e.NEXT_PUBLIC_SITE_URL,
  );
}

/* ------------------------------------------------------------
   Stripe — configuration d'encaissement.
   ------------------------------------------------------------ */

/** Qui encaisse aujourd'hui. */
export function paymentProvider(): "monetico" | "stripe" {
  return env().PAYMENT_PROVIDER;
}

/**
 * Variables manquantes pour encaisser par Stripe.
 *
 * Le secret de webhook est EXIGÉ au même titre que la clé secrète, et ce n'est
 * pas une précaution de confort : sans lui, la route de notification ne peut
 * pas distinguer un événement de Stripe d'un message fabriqué. Un paiement
 * inventé créerait un abonnement gratuit, et un `invoice.paid` inventé
 * prolongerait une période sans qu'un centime soit entré.
 */
export function missingStripeEnv(): string[] {
  const e = env();
  const missing: string[] = [];
  if (!e.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!e.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!e.STRIPE_PRICE_MONTHLY && !e.STRIPE_PRICE_ANNUAL) {
    missing.push("STRIPE_PRICE_MONTHLY ou STRIPE_PRICE_ANNUAL");
  }
  /* Un prix de collaborateur manquant ne se voit qu'au moment où un cabinet en
     déclare un : la souscription partirait alors au tarif du titulaire seul. */
  if (e.STRIPE_PRICE_MONTHLY && !e.STRIPE_PRICE_COLLABORATOR_MONTHLY) {
    missing.push("STRIPE_PRICE_COLLABORATOR_MONTHLY");
  }
  if (e.STRIPE_PRICE_ANNUAL && !e.STRIPE_PRICE_COLLABORATOR_ANNUAL) {
    missing.push("STRIPE_PRICE_COLLABORATOR_ANNUAL");
  }
  return missing;
}

/** Peut-on encaisser par Stripe ? */
export function hasStripeCheckout(): boolean {
  return missingStripeEnv().length === 0;
}

/**
 * Le prestataire retenu est-il réellement utilisable ?
 *
 * C'est la question que les routes doivent poser, plutôt que d'interroger un
 * prestataire en particulier. Elle évite le cas le plus vicieux : déclarer
 * `PAYMENT_PROVIDER=stripe` sans avoir posé les clés, et laisser le tunnel
 * proposer un paiement qui échouera à la dernière seconde, après que le client
 * a saisi tout son dossier.
 */
export function canCollectPayment(): boolean {
  return paymentProvider() === "stripe" ? hasStripeCheckout() : hasCheckout();
}

/** Le socle billing est-il là ? (MAC de l'IPN, base, secrets) */
export function hasBilling(): boolean {
  return missingBillingEnv().length === 0;
}

/** Peut-on ENCAISSER (tunnel, renouvellement, portail) ? */
export function hasCheckout(): boolean {
  return missingCheckoutEnv().length === 0;
}

export type BillingEnv = {
  moneticoTpe: string;
  moneticoKey: string;
  moneticoSociete: string;
  moneticoMode: "test" | "production";
  /* TPE immédiat (offre annuelle one-shot). Chaînes vides si l'annuel est
     fermé ; garanties non vides dès que CHECKOUT_PLANS ouvre l'annuel. */
  moneticoTpeImmediate: string;
  moneticoKeyImmediate: string;
  moneticoSocieteImmediate: string;
  provisioningApiUrl: string;
  provisioningApiKey: string;
  /** Remonter les reconductions à l'app dev B (route livrée de leur côté ?). */
  provisioningRenewalEnabled: boolean;
  /** ICS créancier — chaîne vide si l'étape SEPA est coupée. */
  sepaIcs: string;
  sepaPrenotifyDays: number;
  /** Étape mandat SEPA active dans le tunnel ? */
  sepaEnabled: boolean;
  billingAlertsTo: string;
  turnstileSecretKey: string;
  checkoutPlans: "annual" | "monthly" | "all";
  /**
   * Clés des DEUX plateformes, pour la seule vérification des sceaux entrants.
   * Ne JAMAIS s'en servir pour émettre : l'émission suit `moneticoMode`.
   * Une clé absente vaut undefined (par exemple MONETICO_KEY_TEST retiré de la
   * production) ; l'appelant doit simplement l'ignorer.
   */
  moneticoIpnKeys: {
    test: { recurrent?: string; immediate?: string };
    production: { recurrent?: string; immediate?: string };
  };
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
    // Clé partagée par toute la société : repli sur celle du récurrent.
    moneticoTpeImmediate: e.MONETICO_TPE_IMMEDIATE ?? "",
    moneticoKeyImmediate: moneticoKeyForModeImmediate(e) ?? "",
    /* Repli conservé UNIQUEMENT pour le chemin de LECTURE (vérification du MAC
       d'un IPN entrant, alertes) : il ne doit jamais servir à émettre une
       commande. Toute route qui encaisse passe par hasCheckout(), qui exige
       MONETICO_SOCIETE_IMMEDIATE explicitement dès que l'annuel est vendable. */
    moneticoSocieteImmediate: e.MONETICO_SOCIETE_IMMEDIATE ?? e.MONETICO_SOCIETE ?? "",
    provisioningApiUrl: e.PROVISIONING_API_URL!,
    provisioningApiKey: e.PROVISIONING_API_KEY!,
    provisioningRenewalEnabled: e.PROVISIONING_RENEWAL_ENABLED,
    sepaIcs: e.SEPA_ICS ?? "",
    sepaPrenotifyDays: e.SEPA_PRENOTIFY_DAYS,
    sepaEnabled: e.CHECKOUT_SEPA_ENABLED,
    billingAlertsTo: e.BILLING_ALERTS_TO,
    turnstileSecretKey: e.TURNSTILE_SECRET_KEY!,
    checkoutPlans: e.CHECKOUT_PLANS,
    moneticoIpnKeys: {
      test: moneticoKeysOfPlatform(e, "test"),
      production: moneticoKeysOfPlatform(e, "production"),
    },
  };
}
