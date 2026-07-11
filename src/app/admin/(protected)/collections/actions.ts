"use server";

import { updateTag } from "next/cache";
import {
  requireStaffService,
  requireAdminService,
  ActionError,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import {
  COLLECTIONS_ADMIN,
  type CollectionKey,
} from "@/lib/admin/collections-admin";

/* ============================================================
   CRUD générique des collections. Garde staff (delete = admin),
   validation zod stricte (une row invalide ferait retomber toute
   la collection publique sur le fallback), audit, updateTag.
   ============================================================ */

export type CollectionActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function config(collection: string) {
  const found = COLLECTIONS_ADMIN[collection as CollectionKey];
  if (!found) throw new ActionError(`Collection inconnue : ${collection}`);
  return found;
}

function invalidate(tags: string[]) {
  for (const tag of tags) updateTag(tag);
}

/** Crée ou met à jour une row. */
export async function saveCollectionRow(
  formData: FormData,
): Promise<CollectionActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const cfg = config(String(formData.get("collection") ?? ""));
    const id = String(formData.get("id") ?? "");
    const idColumn = cfg.idColumn ?? "id";

    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("values") ?? "null"));
    } catch {
      throw new ActionError("Valeurs illisibles.");
    }
    const parsed = cfg.schema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ActionError(
        `Valeur invalide (${first.path.join(".") || "row"}) : ${first.message}`,
      );
    }
    const row = cfg.toRow(parsed.data as Record<string, unknown>);

    if (id) {
      const { error } = await service
        .from(cfg.table)
        .update(row)
        .eq(idColumn, id);
      if (error) throw new ActionError(`Enregistrement impossible : ${error.message}`);
    } else {
      if (cfg.fixedRows) throw new ActionError("Cette collection est fixe.");
      /* Position en fin de liste. */
      if (cfg.hasPosition) {
        const { data: last } = await service
          .from(cfg.table)
          .select("position")
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        (row as Record<string, unknown>).position =
          ((last?.position as number) ?? -1) + 1;
      }
      const { error } = await service.from(cfg.table).insert(row);
      if (error) throw new ActionError(`Création impossible : ${error.message}`);
    }

    await logAudit({
      action: id ? "collection.update" : "collection.create",
      entityType: cfg.table,
      entityId: id || undefined,
      diff: row,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidate(cfg.tags);
    return { ok: true, message: "Enregistré — le site est à jour." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Publie / dépublie une row. */
export async function togglePublished(
  formData: FormData,
): Promise<CollectionActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const cfg = config(String(formData.get("collection") ?? ""));
    if (!cfg.hasPublished) throw new ActionError("Collection sans publication.");
    const id = String(formData.get("id") ?? "");
    const published = formData.get("published") === "true";

    const { error } = await service
      .from(cfg.table)
      .update({ published })
      .eq(cfg.idColumn ?? "id", id);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: published ? "collection.publish" : "collection.unpublish",
      entityType: cfg.table,
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidate(cfg.tags);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Échange la position d'une row avec sa voisine. */
export async function moveCollectionRow(
  formData: FormData,
): Promise<CollectionActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const cfg = config(String(formData.get("collection") ?? ""));
    if (!cfg.hasPosition) throw new ActionError("Collection non ordonnée.");
    const id = String(formData.get("id") ?? "");
    const direction = formData.get("direction") === "up" ? -1 : 1;
    const idColumn = cfg.idColumn ?? "id";

    const { data: rows } = await service
      .from(cfg.table)
      .select(`${idColumn}, position`)
      .order("position", { ascending: true });
    const list = (rows ?? []) as unknown as Record<string, unknown>[];
    const index = list.findIndex((row) => String(row[idColumn]) === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) {
      return { ok: true };
    }

    /* Échange des positions (deux updates — trafic admin faible). */
    await service
      .from(cfg.table)
      .update({ position: list[target].position })
      .eq(idColumn, String(list[index][idColumn]));
    await service
      .from(cfg.table)
      .update({ position: list[index].position })
      .eq(idColumn, String(list[target][idColumn]));

    await logAudit({
      action: "collection.reorder",
      entityType: cfg.table,
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidate(cfg.tags);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Suppression (admin). */
export async function deleteCollectionRow(
  formData: FormData,
): Promise<CollectionActionResult> {
  try {
    const { staff, service } = await requireAdminService();
    const cfg = config(String(formData.get("collection") ?? ""));
    if (cfg.fixedRows) throw new ActionError("Cette collection est fixe.");
    const id = String(formData.get("id") ?? "");

    const { error } = await service
      .from(cfg.table)
      .delete()
      .eq(cfg.idColumn ?? "id", id);
    if (error) throw new ActionError(`Suppression impossible : ${error.message}`);

    await logAudit({
      action: "collection.delete",
      entityType: cfg.table,
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidate(cfg.tags);
    return { ok: true, message: "Supprimé." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
