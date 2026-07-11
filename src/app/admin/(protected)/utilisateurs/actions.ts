"use server";

import crypto from "node:crypto";
import { requireAdminService, ActionError, type GuardedContext } from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { env } from "@/lib/env";

/* ============================================================
   Gestion des comptes du back office (admin uniquement).
   Le rôle AUTORITAIRE vit dans auth.users.app_metadata (JWT) —
   profiles.role n'est qu'un miroir UI. Toute modification passe
   par l'API admin GoTrue (service-role) PUIS aligne le miroir.
   Un changement de rôle n'est effectif qu'à la reconnexion de
   l'utilisateur (réémission du JWT).
   ============================================================ */

export type StaffRole = "admin" | "editor";

export type UserActionResult =
  | { ok: true; message?: string; password?: string }
  | { ok: false; message: string };

function parseRole(value: unknown): StaffRole {
  return value === "admin" ? "admin" : "editor";
}

function siteUrl(): string {
  return (env().NEXT_PUBLIC_SITE_URL ?? "https://medicarepro.fr").replace(/\/$/, "");
}

/** Garde « dernier admin » : refuse de rétrograder/désactiver le seul admin. */
async function assertNotLastAdmin(
  service: GuardedContext["service"],
  targetId: string,
): Promise<void> {
  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (target?.role !== "admin") return;

  const { count } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) <= 1) {
    throw new ActionError(
      "Impossible : c'est le dernier compte administrateur du site.",
    );
  }
}

function inviteEmail(confirmUrl: string, role: StaffRole): { text: string; html: string } {
  const roleLabel = role === "admin" ? "administrateur" : "éditeur";
  const text = [
    "Bonjour,",
    "",
    `Vous êtes invité(e) à rejoindre le back office de MediCare Pro en tant que ${roleLabel}.`,
    "Cliquez sur ce lien pour choisir votre mot de passe et activer votre compte :",
    confirmUrl,
    "",
    "Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette invitation, ignorez cet email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#274760">
      <h2 style="color:#1e457f">Invitation au back office MediCare Pro</h2>
      <p>Vous êtes invité(e) à rejoindre le back office de MediCare&nbsp;Pro en tant que <b>${roleLabel}</b>.</p>
      <p style="margin:26px 0">
        <a href="${confirmUrl}" style="background:#2b6fd6;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">
          Activer mon compte
        </a>
      </p>
      <p style="font-size:13px;color:#5d6b7b">Ce lien est valable 24&nbsp;heures. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur&nbsp;:<br>${confirmUrl}</p>
    </div>`;
  return { text, html };
}

/** Invite un nouveau membre par email (lien d'activation). */
export async function inviteUser(formData: FormData): Promise<UserActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = parseRole(formData.get("role"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ActionError("Adresse email invalide.");
    }

    const redirectTo = `${siteUrl()}/admin/auth/confirm`;
    const { data, error } = await service.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (error) {
      throw new ActionError(
        error.code === "email_exists" || /already/i.test(error.message)
          ? "Un compte existe déjà avec cet email."
          : `Invitation impossible : ${error.message}`,
      );
    }

    /* Rôle dans le JWT + miroir profiles (le trigger a créé le profil
       avec le rôle par défaut 'editor'). */
    await service.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role },
    });
    await service.from("profiles").update({ role }).eq("id", data.user.id);

    const confirmUrl = `${siteUrl()}/admin/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite`;
    const mail = inviteEmail(confirmUrl, role);
    await sendMail({
      to: email,
      subject: "Votre accès au back office MediCare Pro",
      ...mail,
    });

    await logAudit({
      action: "user.invite",
      entityType: "profiles",
      entityId: data.user.id,
      diff: { email, role },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return { ok: true, message: `Invitation envoyée à ${email}.` };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Crée un compte directement, avec mot de passe provisoire (affiché UNE fois). */
export async function createUserDirect(formData: FormData): Promise<UserActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = parseRole(formData.get("role"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ActionError("Adresse email invalide.");
    }

    const password = crypto.randomBytes(12).toString("base64url");
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { display_name: email.split("@")[0] },
    });
    if (error) {
      throw new ActionError(
        error.code === "email_exists" || /already/i.test(error.message)
          ? "Un compte existe déjà avec cet email."
          : `Création impossible : ${error.message}`,
      );
    }

    /* Le trigger pose 'editor' par défaut : aligner le miroir. */
    await service.from("profiles").update({ role }).eq("id", data.user.id);

    await logAudit({
      action: "user.create_direct",
      entityType: "profiles",
      entityId: data.user.id,
      diff: { email, role },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return {
      ok: true,
      message: `Compte créé pour ${email}. Transmettez le mot de passe provisoire ci-dessous — il ne sera plus affiché.`,
      password,
    };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Change le rôle d'un compte (JWT + miroir). Effectif à la reconnexion. */
export async function changeRole(formData: FormData): Promise<UserActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const userId = String(formData.get("userId") ?? "");
    const role = parseRole(formData.get("role"));
    if (!userId) throw new ActionError("Utilisateur manquant.");
    if (userId === staff.id) {
      throw new ActionError("Vous ne pouvez pas changer votre propre rôle.");
    }
    if (role === "editor") await assertNotLastAdmin(service, userId);

    const { error } = await service.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });
    if (error) throw new ActionError(`Changement impossible : ${error.message}`);
    await service.from("profiles").update({ role }).eq("id", userId);

    await logAudit({
      action: "user.role_change",
      entityType: "profiles",
      entityId: userId,
      diff: { role },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return {
      ok: true,
      message:
        "Rôle mis à jour. Il sera effectif à la prochaine connexion de l'utilisateur.",
    };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Désactive (ban) ou réactive un compte. */
export async function toggleBan(formData: FormData): Promise<UserActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const userId = String(formData.get("userId") ?? "");
    const ban = formData.get("ban") === "true";
    if (!userId) throw new ActionError("Utilisateur manquant.");
    if (userId === staff.id) {
      throw new ActionError("Vous ne pouvez pas désactiver votre propre compte.");
    }
    if (ban) await assertNotLastAdmin(service, userId);

    const { error } = await service.auth.admin.updateUserById(userId, {
      /* ~100 ans = désactivation ; "none" = levée du ban. */
      ban_duration: ban ? "876000h" : "none",
    });
    if (error) throw new ActionError(`Opération impossible : ${error.message}`);

    await logAudit({
      action: ban ? "user.disable" : "user.enable",
      entityType: "profiles",
      entityId: userId,
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return { ok: true, message: ban ? "Compte désactivé." : "Compte réactivé." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Envoie un lien de réinitialisation de mot de passe. */
export async function sendRecovery(formData: FormData): Promise<UserActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) throw new ActionError("Email manquant.");

    const redirectTo = `${siteUrl()}/admin/auth/confirm`;
    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) throw new ActionError(`Envoi impossible : ${error.message}`);

    const confirmUrl = `${siteUrl()}/admin/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`;
    await sendMail({
      to: email,
      subject: "Réinitialisation de votre mot de passe — Back office MediCare Pro",
      text: `Bonjour,\n\nPour définir un nouveau mot de passe, cliquez sur ce lien (valable 24 h) :\n${confirmUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#274760">
        <h2 style="color:#1e457f">Réinitialisation du mot de passe</h2>
        <p>Pour définir un nouveau mot de passe du back office MediCare&nbsp;Pro, cliquez ci-dessous (lien valable 24&nbsp;h)&nbsp;:</p>
        <p style="margin:26px 0"><a href="${confirmUrl}" style="background:#2b6fd6;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p>
        <p style="font-size:13px;color:#5d6b7b">Si le bouton ne fonctionne pas&nbsp;: ${confirmUrl}</p>
      </div>`,
    });

    await logAudit({
      action: "user.recovery_sent",
      entityType: "profiles",
      diff: { email },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return { ok: true, message: `Lien de réinitialisation envoyé à ${email}.` };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
