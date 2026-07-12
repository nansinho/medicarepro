"use server";

import { updateTag } from "next/cache";
import {
  requireStaffService,
  requireAdminService,
  ActionError,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cms/tags";
import { env } from "@/lib/env";
import { CITY_PROMPT_VERSION } from "@/lib/ai/city-generator";

/* ============================================================
   Actions du module Villes SEO.
   Génération = mise en file `ai_generations` (le worker traite) ;
   la gate humaine (approve/publish) reste manuelle. Publication
   par vague. L'IA ne publie jamais seule.
   ============================================================ */

export type VilleActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Met en file la génération IA d'une ou plusieurs villes 'seeded'. */
export async function queueGeneration(formData: FormData): Promise<VilleActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const ids = formData.getAll("cityId").map(String).filter(Boolean);
    const wave = formData.get("wave") ? Number(formData.get("wave")) : null;

    /* Cible : ids explicites, ou toutes les villes seeded d'une vague. */
    let query = service.from("cities").select("id, status").eq("status", "seeded");
    if (ids.length > 0) query = query.in("id", ids);
    else if (wave) query = query.eq("wave", wave);
    else throw new ActionError("Aucune ville ciblée.");

    const { data: cities } = await query;
    if (!cities || cities.length === 0) {
      return { ok: false, message: "Aucune ville à générer (déjà générées ?)." };
    }

    /* Une génération queued par ville (évite les doublons : on ne met en
       file que celles sans génération en cours). */
    const rows = cities.map((city) => ({
      kind: "city_page",
      subject_id: city.id,
      status: "queued",
      prompt_version: CITY_PROMPT_VERSION,
      created_by: staff.id,
    }));
    const { error } = await service.from("ai_generations").insert(rows);
    if (error) throw new ActionError(`Mise en file impossible : ${error.message}`);

    await logAudit({
      action: "city.queue_generation",
      entityType: "cities",
      diff: { count: rows.length, wave },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    return {
      ok: true,
      message: `${rows.length} ville(s) en file. La génération tourne en arrière-plan.`,
    };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Déclenche le worker immédiatement (au lieu d'attendre le cron). */
export async function triggerWorker(): Promise<VilleActionResult> {
  try {
    await requireStaffService();
    const secret = env().CRON_SECRET;
    const site = (env().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    if (!secret) throw new ActionError("CRON_SECRET non configuré.");

    const res = await fetch(`${site}/api/jobs/ai-generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      processed?: number;
      error?: string;
    };
    if (!res.ok) {
      throw new ActionError(
        body.error === "ia_non_configuree"
          ? "IA non configurée (clé Anthropic manquante)."
          : `Worker : ${body.error ?? res.status}`,
      );
    }
    return { ok: true, message: `${body.processed ?? 0} génération(s) traitée(s).` };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Change le statut de revue d'une ville (needs_review / approved). */
export async function setReviewStatus(formData: FormData): Promise<VilleActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const id = String(formData.get("cityId") ?? "");
    const status = String(formData.get("status") ?? "");
    const notes = String(formData.get("notes") ?? "").slice(0, 1000) || null;
    if (!id) throw new ActionError("Ville manquante.");
    if (!["generated", "needs_review", "approved"].includes(status)) {
      throw new ActionError("Statut de revue invalide.");
    }

    const { error } = await service
      .from("cities")
      .update({ status, review_notes: notes })
      .eq("id", id)
      .in("status", ["generated", "needs_review", "approved"]);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: `city.review.${status}`,
      entityType: "cities",
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Publie les villes approuvées (une ville, ou toute une vague). */
export async function publishCities(formData: FormData): Promise<VilleActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const ids = formData.getAll("cityId").map(String).filter(Boolean);
    const wave = formData.get("wave") ? Number(formData.get("wave")) : null;

    let query = service.from("cities").select("id").eq("status", "approved");
    if (ids.length > 0) query = query.in("id", ids);
    else if (wave) query = query.eq("wave", wave);
    else throw new ActionError("Aucune ville ciblée.");

    const { data: cities } = await query;
    if (!cities || cities.length === 0) {
      return { ok: false, message: "Aucune ville approuvée à publier." };
    }

    const { error } = await service
      .from("cities")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in(
        "id",
        cities.map((c) => c.id),
      );
    if (error) throw new ActionError(`Publication impossible : ${error.message}`);

    await logAudit({
      action: "city.publish",
      entityType: "cities",
      diff: { count: cities.length, wave },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    updateTag(TAGS.cities);
    updateTag(TAGS.sitemap);
    return { ok: true, message: `${cities.length} ville(s) publiée(s) — en ligne.` };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Retire une ville publiée (retour en approved). Admin. */
export async function unpublishCity(formData: FormData): Promise<VilleActionResult> {
  try {
    const { staff, service } = await requireAdminService();
    const id = String(formData.get("cityId") ?? "");
    if (!id) throw new ActionError("Ville manquante.");

    const { error } = await service
      .from("cities")
      .update({ status: "approved", published_at: null })
      .eq("id", id)
      .eq("status", "published");
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: "city.unpublish",
      entityType: "cities",
      entityId: id,
      actorId: staff.id,
      actorEmail: staff.email,
    });
    updateTag(TAGS.cities);
    updateTag(TAGS.sitemap);
    return { ok: true, message: "Ville dépubliée." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
