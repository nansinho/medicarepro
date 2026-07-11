import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/email";
import {
  contactEmailHtml,
  contactEmailText,
} from "@/lib/emails/contact-template";
import { serviceClient } from "@/lib/supabase/service";
import { clientIpFrom } from "@/lib/http/client-ip";

/* ============================================================
   POST /api/contact — réception du formulaire de contact.
   Valide la demande, applique un rate-limit par IP (si Supabase
   est configuré), puis envoie un email à CONTACT_TO
   (contact@medicarepro.fr) depuis SMTP_FROM (noreply@…).
   L'email du visiteur est mis en Reply-To pour répondre en un clic.
   Après envoi, la demande est tracée en base (best-effort).
   Toujours dynamique (envoi réseau à chaque requête).
   ============================================================ */
export const dynamic = "force-dynamic";

/** Nombre de praticiens — valeurs proposées par le <select> du formulaire. */
const PRATICIENS = ["1", "2-3", "4+"] as const;

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  email: z.email("Email invalide").max(180),
  tel: z.string().trim().max(40).optional().default(""),
  praticiens: z.enum(PRATICIENS).optional().default("1"),
  message: z.string().trim().max(4000).optional().default(""),
  // Honeypot anti-spam : champ masqué, rempli uniquement par les bots.
  // On l'accepte à la validation, puis on court-circuite l'envoi (ci-dessous)
  // sans rien signaler — inutile d'apprendre au bot que c'est un piège.
  company: z.string().max(200).optional().default(""),
});

const PRATICIENS_LABEL: Record<(typeof PRATICIENS)[number], string> = {
  "1": "1 (libéral)",
  "2-3": "2 à 3",
  "4+": "4 et plus",
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Formulaire invalide.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Honeypot rempli → on répond « OK » sans envoyer (on ne signale rien au bot).
  if (parsed.data.company) {
    return Response.json({ ok: true });
  }

  const { name, email, tel, praticiens, message } = parsed.data;
  const praticiensLabel = PRATICIENS_LABEL[praticiens];

  // Rate-limit par IP : 5 demandes / heure. Si la limite est dépassée, on
  // répond « OK » factice (même réponse qu'un envoi réussi) — inutile de
  // guider les spammeurs. Sans Supabase, comportement inchangé.
  const sb = serviceClient();
  const ip = clientIpFrom(request.headers);
  if (sb) {
    try {
      const { data: allowed, error } = await sb.rpc("hit_rate_limit", {
        p_bucket: `contact:${ip}`,
        p_limit: 5,
        p_window_seconds: 3600,
      });
      if (!error && allowed === false) {
        return Response.json({ ok: true });
      }
    } catch {
      // RPC indisponible : on ne bloque pas un contact légitime.
    }
  }

  const submittedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());

  const emailData = { name, email, tel, praticiensLabel, message, submittedAt };

  try {
    await sendMail({
      to: env().CONTACT_TO,
      subject: `Nouvelle demande de contact — ${name}`,
      text: contactEmailText(emailData),
      html: contactEmailHtml(emailData),
      replyTo: email,
    });
  } catch (err) {
    console.error("[contact] échec de l'envoi de l'email :", err);
    return Response.json(
      { error: "L'envoi a échoué. Réessayez ou écrivez-nous directement." },
      { status: 502 },
    );
  }

  // Trace en base, best-effort : un échec ici ne casse jamais la réponse
  // (l'email est déjà parti). IP stockée hachée (jamais en clair).
  if (sb) {
    try {
      const { error } = await sb.from("contact_requests").insert({
        name,
        email,
        phone: tel,
        practitioners: praticiens,
        message,
        consent: true,
        source: "site",
        ip_hash: createHash("sha256").update(ip).digest("hex"),
        user_agent: request.headers.get("user-agent") ?? "",
      });
      if (error) {
        console.error(
          "[contact] insertion contact_requests échouée :",
          error.message,
        );
      }
    } catch {
      // Ignoré : la demande a bien été transmise par email.
    }
  }

  return Response.json({ ok: true });
}
