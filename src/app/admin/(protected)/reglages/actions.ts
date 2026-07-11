"use server";

import { updateTag } from "next/cache";
import { requireAdminService, ActionError } from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cms/tags";
import {
  SETTINGS_SCHEMAS,
  type EditableSettingKey,
} from "@/lib/admin/settings-forms";

/* ============================================================
   Sauvegarde d'un réglage : garde admin → validation zod stricte
   (forme canonique du fallback, sinon la valeur serait ignorée
   au rendu) → upsert → audit → revalidation du tag settings.
   ============================================================ */

export type SaveSettingResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveSetting(
  key: EditableSettingKey,
  rawValue: unknown,
): Promise<SaveSettingResult> {
  try {
    const { staff, service } = await requireAdminService();

    const schema = SETTINGS_SCHEMAS[key];
    if (!schema) throw new ActionError(`Réglage inconnu : ${key}`);

    const parsed = schema.safeParse(rawValue);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ActionError(
        `Valeur invalide (${first.path.join(".") || key}) : ${first.message}`,
      );
    }

    const { error } = await service
      .from("site_settings")
      .upsert({ key, value: parsed.data, is_public: true });
    if (error) throw new ActionError(`Enregistrement impossible : ${error.message}`);

    await logAudit({
      action: "settings.update",
      entityType: "site_settings",
      entityId: key,
      diff: { value: parsed.data },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    /* LE point critique du repo : sans invalidation, jusqu'à 1 h de
       latence sur le site public. updateTag (Next 16) = expiration
       immédiate, l'admin voit son changement dès le rechargement. */
    updateTag(TAGS.settings);

    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
