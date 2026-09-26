"use server";

import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import {
  STAFF_LINK_HOURS,
  staffConfirmRedirect,
  staffConfirmUrl,
} from "@/lib/admin/staff-links";
import { staffRecoveryEmail } from "@/lib/emails/staff-templates";

/* ============================================================
   Demande de réinitialisation depuis /admin/login : action
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

    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: staffConfirmRedirect() },
    });
    if (error || !data) return { ok: true };

    await sendMail({
      to: email,
      ...staffRecoveryEmail({
        link: staffConfirmUrl(data.properties.hashed_token, "recovery", email),
        email,
        validHours: STAFF_LINK_HOURS,
      }),
    });
  } catch (err) {
    /* Réponse identique quoi qu'il arrive (anti-énumération), mais l'échec
       doit laisser une trace côté serveur. */
    console.error(
      "[mot-de-passe-oublie] envoi impossible :",
      err instanceof Error ? err.message : String(err),
    );
  }
  return { ok: true };
}
