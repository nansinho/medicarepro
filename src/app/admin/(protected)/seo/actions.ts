"use server";

import { updateTag } from "next/cache";
import {
  requireStaffService,
  requireAdminService,
  ActionError,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cms/tags";
import { SEO_DEFAULTS } from "@/data/content/site";

/* ============================================================
   Actions SEO : métas par route (staff), redirections (admin —
   aligné RLS), purge des 404 (admin).
   ============================================================ */

export type SeoActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const CHANGEFREQS = new Set(["weekly", "monthly", "yearly"]);
const REDIRECT_CODES = new Set([301, 302, 307, 308]);

/** Met à jour les métas d'une route (upsert par path). */
export async function saveSeoMeta(formData: FormData): Promise<SeoActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const path = String(formData.get("path") ?? "");
    if (!path.startsWith("/")) throw new ActionError("Chemin invalide.");
    /* Périmètre : routes gérées + articles du blog. */
    if (!(path in SEO_DEFAULTS) && !path.startsWith("/blog/")) {
      throw new ActionError(`Route hors périmètre SEO : ${path}`);
    }

    const priority = Number(formData.get("sitemap_priority") ?? 0.5);
    const changefreq = String(formData.get("sitemap_changefreq") ?? "monthly");
    if (Number.isNaN(priority) || priority < 0 || priority > 1) {
      throw new ActionError("Priorité sitemap entre 0.0 et 1.0.");
    }
    if (!CHANGEFREQS.has(changefreq)) {
      throw new ActionError("Fréquence sitemap invalide.");
    }

    const row = {
      path,
      title: String(formData.get("title") ?? "").trim() || null,
      title_absolute: formData.get("title_absolute") === "true",
      description: String(formData.get("description") ?? "").trim() || null,
      canonical: String(formData.get("canonical") ?? "").trim() || null,
      noindex: formData.get("noindex") === "true",
      sitemap_include: formData.get("sitemap_include") !== "false",
      sitemap_priority: priority,
      sitemap_changefreq: changefreq,
      updated_by: staff.id,
    };

    const { error } = await service
      .from("seo_meta")
      .upsert(row, { onConflict: "path" });
    if (error) throw new ActionError(`Enregistrement impossible : ${error.message}`);

    await logAudit({
      action: "seo.meta_update",
      entityType: "seo_meta",
      entityId: path,
      diff: row,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    updateTag(TAGS.seo);
    updateTag(TAGS.sitemap);
    return { ok: true, message: "Métas enregistrées — site à jour." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Crée ou met à jour une redirection (admin). */
export async function saveRedirect(formData: FormData): Promise<SeoActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const fromPath = String(formData.get("from_path") ?? "").trim();
    const toPath = String(formData.get("to_path") ?? "").trim();
    const statusCode = Number(formData.get("status_code") ?? 301);
    if (!fromPath.startsWith("/")) throw new ActionError("Le chemin source doit commencer par /.");
    if (!toPath.startsWith("/") && !/^https?:\/\//.test(toPath)) {
      throw new ActionError("La destination doit être un chemin interne ou une URL.");
    }
    if (fromPath === toPath) throw new ActionError("Source et destination identiques.");
    if (!REDIRECT_CODES.has(statusCode)) throw new ActionError("Code invalide.");

    const { error } = await service.from("redirects").upsert(
      {
        from_path: fromPath,
        to_path: toPath,
        status_code: statusCode,
        is_active: true,
      },
      { onConflict: "from_path" },
    );
    if (error) throw new ActionError(`Enregistrement impossible : ${error.message}`);

    /* Le 404 correspondant est réglé : on le retire de la liste. */
    await service.from("not_found_logs").delete().eq("path", fromPath);

    await logAudit({
      action: "seo.redirect_save",
      entityType: "redirects",
      entityId: fromPath,
      diff: { toPath, statusCode },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    updateTag(TAGS.redirects);
    return { ok: true, message: "Redirection active immédiatement." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Active/désactive une redirection (admin). */
export async function toggleRedirect(formData: FormData): Promise<SeoActionResult> {
  try {
    const { staff, service } = await requireAdminService();
    const id = String(formData.get("id") ?? "");
    const isActive = formData.get("is_active") === "true";

    const { error } = await service
      .from("redirects")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: isActive ? "seo.redirect_enable" : "seo.redirect_disable",
      entityType: "redirects",
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    updateTag(TAGS.redirects);
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Supprime une redirection (admin). */
export async function deleteRedirect(formData: FormData): Promise<SeoActionResult> {
  try {
    const { staff, service } = await requireAdminService();
    const id = String(formData.get("id") ?? "");

    const { error } = await service.from("redirects").delete().eq("id", id);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: "seo.redirect_delete",
      entityType: "redirects",
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    updateTag(TAGS.redirects);
    return { ok: true, message: "Redirection supprimée." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Retire une entrée du journal des 404 (admin). */
export async function dismissNotFound(formData: FormData): Promise<SeoActionResult> {
  try {
    const { staff, service } = await requireAdminService();
    const path = String(formData.get("path") ?? "");

    const { error } = await service.from("not_found_logs").delete().eq("path", path);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: "seo.notfound_dismiss",
      entityType: "not_found_logs",
      entityId: path,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
