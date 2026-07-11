import { z } from "zod";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";

/* ============================================================
   Validation du dossier d'inscription (tunnel checkout).

   Reprend EXACTEMENT les règles du contrat de provisioning dev B
   (§6) pour que rien ne parte en 400 après encaissement, plus
   nos champs propres : mandat SEPA (IBAN), consentements, anti-spam.
   Partagée entre le client (feedback par étape) et la route
   POST /api/checkout (validation d'autorité).
   ============================================================ */

/** Mot de passe : ≥ 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre (contrat §6). */
export const PasswordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/\d/, "Au moins un chiffre")
  .max(200);

export const CabinetSchema = z.object({
  name: z.string().trim().min(1, "Nom du cabinet requis").max(200),
  email: z.email("Email du cabinet invalide").max(180),
  phone: z.string().trim().min(1, "Téléphone fixe requis").max(30),
  mobilePhone: z.string().trim().min(1, "Téléphone portable requis").max(30),
  address: z.string().trim().min(1, "Adresse requise").max(300),
  city: z.string().trim().min(1, "Ville requise").max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal : 5 chiffres"),
  siretNumber: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "SIRET : 14 chiffres")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  rppsNumber: z.string().trim().min(1, "Numéro RPPS requis").max(20),
});

export const UserSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(100),
  lastName: z.string().trim().min(1, "Nom requis").max(100),
  email: z.email("Email invalide").max(180),
  password: PasswordSchema,
});

export const SepaSchema = z.object({
  iban: z
    .string()
    .trim()
    .transform((v) => electronicFormatIBAN(v) ?? v)
    .refine((v) => isValidIBAN(v), "IBAN invalide"),
  bic: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/i, "BIC invalide")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  accountHolder: z.string().trim().min(1, "Titulaire du compte requis").max(200),
});

export const CheckoutSchema = z.object({
  plan: z.enum(["MONTHLY", "ANNUAL"]),
  extraCollaborators: z.coerce.number().int().min(0).max(20).default(0),
  cabinet: CabinetSchema,
  user: UserSchema,
  sepa: SepaSchema,
  /** Case contractuelle unique (CGV + CGU + DPA + grille tarifaire) — obligatoire, non pré-cochée. */
  termsAccepted: z.literal(true, {
    error: "Vous devez accepter les conditions contractuelles",
  }),
  /** Case mandat SEPA — obligatoire et distincte des CGV. */
  mandateAccepted: z.literal(true, {
    error: "Vous devez accepter le mandat de prélèvement",
  }),
  /** Jeton Cloudflare Turnstile (anti-bot). */
  turnstileToken: z.string().min(1, "Vérification anti-robot requise"),
  /** Honeypot : rempli uniquement par les bots (doit rester vide). */
  website: z.string().max(200).optional().default(""),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;
