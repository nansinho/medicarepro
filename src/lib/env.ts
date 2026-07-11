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
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Écarte les variables vides avant validation : dans un fichier `.env`,
 * une clé sans valeur (`FOO=`) est lue comme la chaîne `""` et non comme
 * `undefined` — ce qui ferait échouer les `.optional()`/`.default()`.
 * On les convertit donc en `undefined` pour que « vide » = « absent ».
 */
function withoutEmptyStrings(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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
