"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminService, ActionError, type GuardedContext } from "@/lib/admin/guards";
import type { StaffUser } from "@/lib/admin/auth";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import {
  STAFF_LINK_HOURS,
  staffConfirmRedirect,
  staffConfirmUrl,
} from "@/lib/admin/staff-links";
import {
  staffInviteEmail,
  staffRecoveryEmail,
  type StaffRole,
} from "@/lib/emails/staff-templates";

/* ============================================================
   Gestion des comptes du back office (admin uniquement).

   Le rôle AUTORITAIRE vit dans auth.users.app_metadata (JWT) :
   profiles.role n'est qu'un miroir UI. Toute modification passe
   par l'API admin GoTrue (service-role) PUIS aligne le miroir.
   Un changement de rôle n'est effectif qu'à la reconnexion de
   l'utilisateur (réémission du JWT).

   LES ACTIONS RENDENT LEUR RÉSULTAT AU LIEU DE JETER. Un email qui ne
   part pas n'est pas une erreur fatale : le compte existe, le lien aussi,
   on le montre à l'administrateur pour qu'il le transmette autrement.
   Avant, un échec SMTP faisait planter l'action APRÈS la création du
   compte, sans lien ni moyen de renvoyer.
   ============================================================ */

export type NewMemberState =
  | {
      ok: true;
      kind: "invite";
      email: string;
      link: string;
      emailSent: boolean;
      /** L'adresse avait déjà une invitation en attente : elle est remplacée. */
      replaced: boolean;
    }
  | { ok: true; kind: "direct"; email: string; password: string }
  | { ok: false; field?: "email" | "name"; error: string }
  | null;

export type MemberRowState =
  | { ok: true; message: string; link?: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseRole(value: unknown): StaffRole {
  return value === "admin" ? "admin" : "editor";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ActionError) return err.message;
  console.error("[utilisateurs]", err instanceof Error ? err.message : String(err));
  return fallback;
}

/** Nom de l'invitant, seulement s'il a été saisi (pas le préfixe de l'email). */
function inviterName(staff: StaffUser): string | null {
  return staff.displayName && staff.displayName !== staff.email.split("@")[0]
    ? staff.displayName
    : null;
}

async function trySend(
  mail: Parameters<typeof sendMail>[0],
  context: string,
): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (err) {
    console.error(
      `[utilisateurs] ${context} : email non parti :`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
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

/** Le compte auth d'un membre, ou une erreur lisible. */
async function authUser(service: GuardedContext["service"], userId: string) {
  if (!userId) throw new ActionError("Membre manquant.");
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error || !data.user) throw new ActionError("Ce compte n'existe plus. Rechargez la page.");
  return data.user;
}

/**
 * Émet (ou réémet) le lien d'invitation et l'envoie.
 *
 * GoTrue accepte de réinviter une adresse tant qu'elle n'est pas confirmée :
 * il remplace le jeton, l'ancien lien cesse de fonctionner. Une adresse déjà
 * active est refusée (email_exists).
 */
async function issueInvite(
  { staff, service }: GuardedContext,
  input: { email: string; role: StaffRole; name?: string },
): Promise<{ userId: string; link: string; emailSent: boolean }> {
  const { data, error } = await service.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      redirectTo: staffConfirmRedirect(),
      /* Lu par le trigger handle_new_user à la création du profil. */
      ...(input.name ? { data: { display_name: input.name } } : {}),
    },
  });
  if (error || !data.user) {
    throw new ActionError(
      error?.code === "email_exists" || /already/i.test(error?.message ?? "")
        ? "Cette adresse a déjà un compte actif. Pour lui redonner accès, envoyez-lui un lien de mot de passe depuis la liste."
        : `Invitation impossible : ${error?.message ?? "réponse vide de GoTrue"}.`,
    );
  }

  /* Rôle dans le JWT + miroir profiles (le trigger a posé 'editor' par
     défaut : il ne voit pas l'app_metadata, appliqué après l'insertion). */
  const { error: roleError } = await service.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: input.role },
  });
  if (roleError) {
    throw new ActionError(
      `Le compte est créé mais le rôle n'a pas pu être attribué (${roleError.message}). Renvoyez l'invitation pour réessayer.`,
    );
  }
  await service
    .from("profiles")
    .update({ role: input.role, ...(input.name ? { display_name: input.name } : {}) })
    .eq("id", data.user.id);

  const link = staffConfirmUrl(data.properties.hashed_token, "invite", input.email);
  const emailSent = await trySend(
    {
      to: input.email,
      ...staffInviteEmail({
        link,
        role: input.role,
        email: input.email,
        inviterName: inviterName(staff),
        validHours: STAFF_LINK_HOURS,
      }),
    },
    "invitation",
  );

  return { userId: data.user.id, link, emailSent };
}

/* ------------------------------------------------------------
   Nouveau membre : invitation par email, ou création directe.
   Le bouton pressé porte l'intention (intent=invite|direct).
   ------------------------------------------------------------ */

export async function addMember(
  _prev: NewMemberState,
  formData: FormData,
): Promise<NewMemberState> {
  try {
    const ctx = await requireAdminService();
    const { staff, service } = ctx;

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const role = parseRole(formData.get("role"));
    const intent = formData.get("intent") === "direct" ? "direct" : "invite";

    if (!EMAIL_RE.test(email) || email.length > 180) {
      return { ok: false, field: "email", error: "Adresse email invalide." };
    }
    if (name.length > 80) {
      return { ok: false, field: "name", error: "80 caractères au plus." };
    }

    const { data: existing } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (intent === "invite") {
      const { userId, link, emailSent } = await issueInvite(ctx, {
        email,
        role,
        name: name || undefined,
      });
      await logAudit({
        action: existing ? "user.invite_resent" : "user.invite",
        entityType: "profiles",
        entityId: userId,
        diff: { email, role, emailSent },
        actorId: staff.id,
        actorEmail: staff.email,
      });
      revalidatePath("/admin/utilisateurs");
      return { ok: true, kind: "invite", email, link, emailSent, replaced: Boolean(existing) };
    }

    if (existing) {
      return {
        ok: false,
        field: "email",
        error: "Cette adresse a déjà un compte. Renvoyez l'invitation ou un lien de mot de passe depuis la liste.",
      };
    }

    const password = crypto.randomBytes(12).toString("base64url");
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { display_name: name || email.split("@")[0] },
    });
    if (error || !data.user) {
      throw new ActionError(
        error?.code === "email_exists" || /already/i.test(error?.message ?? "")
          ? "Un compte existe déjà avec cet email."
          : `Création impossible : ${error?.message ?? "réponse vide de GoTrue"}.`,
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

    revalidatePath("/admin/utilisateurs");
    return { ok: true, kind: "direct", email, password };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "L'opération a échoué. Réessayez.") };
  }
}

/* ------------------------------------------------------------
   Invitation en attente : renvoi (nouveau lien) ou annulation.
   ------------------------------------------------------------ */

export async function resendInvite(userId: string): Promise<MemberRowState> {
  try {
    const ctx = await requireAdminService();
    const user = await authUser(ctx.service, userId);
    if (user.email_confirmed_at) {
      return { ok: false, error: "Ce compte est déjà activé : envoyez plutôt un lien de mot de passe." };
    }
    const email = user.email ?? "";
    const role = parseRole(user.app_metadata?.role);
    const { link, emailSent } = await issueInvite(ctx, { email, role });

    await logAudit({
      action: "user.invite_resent",
      entityType: "profiles",
      entityId: userId,
      diff: { email, emailSent },
      actorId: ctx.staff.id,
      actorEmail: ctx.staff.email,
    });
    revalidatePath("/admin/utilisateurs");
    return {
      ok: true,
      message: emailSent
        ? `Nouveau lien envoyé à ${email}. L'ancien ne fonctionne plus.`
        : `Nouveau lien créé, mais l'email n'est pas parti : transmettez le lien à ${email}.`,
      link,
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Le renvoi a échoué. Réessayez.") };
  }
}

export async function cancelInvite(userId: string): Promise<MemberRowState> {
  try {
    const { staff, service } = await requireAdminService();
    const user = await authUser(service, userId);
    /* Seul un compte jamais activé se supprime : un compte qui a servi se
       désactive, pour garder la trace de ce qu'il a fait. */
    if (user.email_confirmed_at || user.last_sign_in_at) {
      return { ok: false, error: "Ce compte a déjà été activé : désactivez-le plutôt." };
    }
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw new ActionError(`Annulation impossible : ${error.message}`);

    await logAudit({
      action: "user.invite_revoke",
      entityType: "profiles",
      entityId: userId,
      diff: { email: user.email },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: `Invitation de ${user.email} annulée : le lien ne fonctionne plus.` };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "L'annulation a échoué. Réessayez.") };
  }
}

/* ------------------------------------------------------------
   Suppression définitive d'un compte (actif ou désactivé).

   Ce qui reste : le journal d'audit (actor_id sans clé étrangère,
   actor_email recopié), et les contenus créés par la personne, dont
   la référence passe à NULL (on delete set null partout, vérifié sur
   toutes les migrations). Le profil part avec le compte (cascade).
   ------------------------------------------------------------ */

export async function deleteMember(userId: string): Promise<MemberRowState> {
  try {
    const { staff, service } = await requireAdminService();
    if (userId === staff.id) {
      throw new ActionError("Vous ne pouvez pas supprimer votre propre compte.");
    }
    const user = await authUser(service, userId);
    await assertNotLastAdmin(service, userId);

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw new ActionError(`Suppression impossible : ${error.message}`);

    await logAudit({
      action: "user.delete",
      entityType: "profiles",
      entityId: userId,
      diff: { email: user.email, role: parseRole(user.app_metadata?.role) },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    revalidatePath("/admin/utilisateurs");
    return {
      ok: true,
      message: `Compte de ${user.email} supprimé. Son historique reste consultable dans le journal d'audit.`,
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "La suppression a échoué. Réessayez.") };
  }
}

/* ------------------------------------------------------------
   Compte actif : rôle, lien de mot de passe, désactivation.
   ------------------------------------------------------------ */

export async function changeRole(userId: string, nextRole: string): Promise<MemberRowState> {
  try {
    const { staff, service } = await requireAdminService();
    const role = parseRole(nextRole);
    if (!userId) throw new ActionError("Membre manquant.");
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

    revalidatePath("/admin/utilisateurs");
    return {
      ok: true,
      message: `Rôle ${role === "admin" ? "administrateur" : "éditeur"} attribué. Il prend effet à la prochaine connexion de la personne.`,
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Le changement a échoué. Réessayez.") };
  }
}

export async function sendRecovery(userId: string): Promise<MemberRowState> {
  try {
    const { staff, service } = await requireAdminService();
    const user = await authUser(service, userId);
    const email = user.email ?? "";

    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: staffConfirmRedirect() },
    });
    if (error || !data) {
      throw new ActionError(`Lien impossible à créer : ${error?.message ?? "réponse vide"}.`);
    }

    const link = staffConfirmUrl(data.properties.hashed_token, "recovery", email);
    const emailSent = await trySend(
      { to: email, ...staffRecoveryEmail({ link, email, validHours: STAFF_LINK_HOURS }) },
      "réinitialisation",
    );

    await logAudit({
      action: "user.recovery_sent",
      entityType: "profiles",
      entityId: userId,
      diff: { email, emailSent },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return {
      ok: true,
      message: emailSent
        ? `Lien de mot de passe envoyé à ${email} (valable ${STAFF_LINK_HOURS} h).`
        : `Lien créé, mais l'email n'est pas parti : transmettez le lien à ${email}.`,
      link,
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "L'envoi a échoué. Réessayez.") };
  }
}

export async function setBanned(userId: string, ban: boolean): Promise<MemberRowState> {
  try {
    const { staff, service } = await requireAdminService();
    if (!userId) throw new ActionError("Membre manquant.");
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

    revalidatePath("/admin/utilisateurs");
    return {
      ok: true,
      message: ban
        ? "Compte désactivé : la personne ne peut plus se connecter."
        : "Compte réactivé.",
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "L'opération a échoué. Réessayez.") };
  }
}
