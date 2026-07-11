"use server";

import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { env } from "@/lib/env";

/* ============================================================
   Demande de réinitialisation depuis /admin/login — action
   PUBLIQUE (pas de session). Réponse identique que le compte
   existe ou non (anti-énumération) ; seuls les emails présents
   dans profiles (staff) reçoivent réellement un lien.
   ============================================================ */

export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: true }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: true };

  const service = serviceClient();
  if (!service) return { ok: true };

  try {
    /* Seul le staff connu reçoit un lien. */
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!profile) return { ok: true };

    const site = (env().NEXT_PUBLIC_SITE_URL ?? "https://medicarepro.fr").replace(/\/$/, "");
    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${site}/admin/auth/confirm` },
    });
    if (error || !data) return { ok: true };

    const confirmUrl = `${site}/admin/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`;
    await sendMail({
      to: email,
      subject: "Réinitialisation de votre mot de passe — Back office MediCare Pro",
      text: `Bonjour,\n\nPour définir un nouveau mot de passe, cliquez sur ce lien (valable 24 h) :\n${confirmUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#274760">
        <h2 style="color:#1e457f">Réinitialisation du mot de passe</h2>
        <p>Pour définir un nouveau mot de passe du back office MediCare&nbsp;Pro, cliquez ci-dessous (lien valable 24&nbsp;h)&nbsp;:</p>
        <p style="margin:26px 0"><a href="${confirmUrl}" style="background:#2b6fd6;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p>
      </div>`,
    });
  } catch {
    /* Réponse identique quoi qu'il arrive (anti-énumération). */
  }
  return { ok: true };
}
