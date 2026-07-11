"use server";

import { updateTag } from "next/cache";
import {
  requireStaffService,
  ActionError,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cms/tags";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { SectionContentSchema } from "@/lib/cms/sections.schema";

/* ============================================================
   Actions de l'éditeur de pages.
   - saveSectionDraft : autosave → page_sections.draft (invisible
     du public), avec contrôle optimiste (updated_at).
   - publishPage : draft → content pour toute la page, snapshot
     `revisions`, invalidation des tags. VALIDATION ZOD STRICTE
     avant écriture : un payload invalide ferait silencieusement
     retomber le site sur le fallback.
   - discardDrafts / restoreRevision : gestion des brouillons.
   ============================================================ */

export type PageActionResult =
  | { ok: true; message?: string; updatedAt?: string }
  | { ok: false; message: string; conflict?: boolean };

/** Tags de collections consommées par certains types de sections. */
const COLLECTION_TAGS: Record<string, string[]> = {
  reviews: [TAGS.testimonials],
  faq: [TAGS.faq],
  pricing: [TAGS.pricing, TAGS.features],
  feature_showcase: [TAGS.features],
  feature_scroll: [TAGS.features],
};

async function getPageId(
  service: Awaited<ReturnType<typeof requireStaffService>>["service"],
  slug: string,
): Promise<string> {
  const { data } = await service
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) {
    throw new ActionError(
      `Page « ${slug} » absente de la base (seed non appliqué ?).`,
    );
  }
  return data.id;
}

/** Autosave du brouillon d'une section. */
export async function saveSectionDraft(
  formData: FormData,
): Promise<PageActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const slug = String(formData.get("slug") ?? "");
    const sectionKey = String(formData.get("sectionKey") ?? "");
    const baseUpdatedAt = String(formData.get("baseUpdatedAt") ?? "");
    const page = FALLBACK_PAGES[slug];
    if (!page) throw new ActionError(`Page inconnue : ${slug}`);
    const slot = page.sections.find((s) => s.key === sectionKey);
    if (!slot) throw new ActionError(`Section inconnue : ${sectionKey}`);

    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("content") ?? "null"));
    } catch {
      throw new ActionError("Contenu illisible.");
    }

    /* Validation stricte AVANT écriture (défauts _v appliqués). */
    const parsed = SectionContentSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ActionError(
        `Contenu invalide (${first.path.join(".") || "payload"}) : ${first.message}`,
      );
    }
    if (parsed.data.type !== slot.type) {
      throw new ActionError(
        `Type incohérent : ${parsed.data.type} ≠ ${slot.type}.`,
      );
    }

    const pageId = await getPageId(service, slug);

    /* Contrôle optimiste : refuse si un autre staff a modifié depuis. */
    const { data: existing } = await service
      .from("page_sections")
      .select("id, updated_at")
      .eq("page_id", pageId)
      .eq("section_key", sectionKey)
      .maybeSingle();
    if (
      existing &&
      baseUpdatedAt &&
      existing.updated_at &&
      new Date(existing.updated_at).getTime() >
        new Date(baseUpdatedAt).getTime()
    ) {
      return {
        ok: false,
        conflict: true,
        message:
          "Cette section a été modifiée par quelqu'un d'autre — rechargez la page avant de continuer.",
      };
    }

    const { data: updated, error } = await service
      .from("page_sections")
      .upsert(
        {
          page_id: pageId,
          section_key: sectionKey,
          type: slot.type,
          /* content requis (NOT NULL) : conservé tel quel si la row existe,
             sinon initialisé au payload publié du fallback. */
          ...(existing ? {} : { content: slot.content }),
          draft: parsed.data,
          updated_by: staff.id,
        },
        { onConflict: "page_id,section_key" },
      )
      .select("updated_at")
      .single();
    if (error) throw new ActionError(`Enregistrement impossible : ${error.message}`);

    return { ok: true, updatedAt: updated.updated_at as string };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Publie tous les brouillons d'une page (draft → content + snapshot). */
export async function publishPage(formData: FormData): Promise<PageActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const slug = String(formData.get("slug") ?? "");
    const page = FALLBACK_PAGES[slug];
    if (!page) throw new ActionError(`Page inconnue : ${slug}`);
    const pageId = await getPageId(service, slug);

    const { data: rows } = await service
      .from("page_sections")
      .select("id, section_key, type, content, draft")
      .eq("page_id", pageId);

    const withDraft = (rows ?? []).filter((row) => row.draft != null);
    if (withDraft.length === 0) {
      return { ok: false, message: "Aucune modification à publier." };
    }

    /* Snapshot AVANT publication (rollback). */
    await service.from("revisions").insert({
      entity_type: "page",
      entity_id: pageId,
      snapshot: {
        slug,
        sections: (rows ?? []).map((row) => ({
          section_key: row.section_key,
          type: row.type,
          content: row.content,
        })),
      },
      created_by: staff.id,
    });

    const types = new Set<string>();
    for (const row of withDraft) {
      /* Re-validation stricte du brouillon avant qu'il devienne public. */
      const parsed = SectionContentSchema.safeParse(row.draft);
      if (!parsed.success || parsed.data.type !== row.type) {
        throw new ActionError(
          `Brouillon invalide sur la section « ${row.section_key} » — publication annulée.`,
        );
      }
      const { error } = await service
        .from("page_sections")
        .update({ content: parsed.data, draft: null, updated_by: staff.id })
        .eq("id", row.id);
      if (error) {
        throw new ActionError(`Publication impossible : ${error.message}`);
      }
      types.add(row.type);
    }

    await logAudit({
      action: "page.publish",
      entityType: "pages",
      entityId: pageId,
      diff: { slug, sections: withDraft.map((r) => r.section_key) },
      actorId: staff.id,
      actorEmail: staff.email,
    });

    updateTag(TAGS.page(slug));
    updateTag(TAGS.pages);
    for (const type of types) {
      for (const tag of COLLECTION_TAGS[type] ?? []) updateTag(tag);
    }

    return {
      ok: true,
      message: `${withDraft.length} section(s) publiée(s) — le site est à jour.`,
    };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Abandonne tous les brouillons d'une page. */
export async function discardDrafts(formData: FormData): Promise<PageActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const slug = String(formData.get("slug") ?? "");
    if (!FALLBACK_PAGES[slug]) throw new ActionError(`Page inconnue : ${slug}`);
    const pageId = await getPageId(service, slug);

    const { error } = await service
      .from("page_sections")
      .update({ draft: null, updated_by: staff.id })
      .eq("page_id", pageId)
      .not("draft", "is", null);
    if (error) throw new ActionError(error.message);

    await logAudit({
      action: "page.discard_drafts",
      entityType: "pages",
      entityId: pageId,
      diff: { slug },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    return { ok: true, message: "Brouillons abandonnés." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

export type PageRevision = {
  id: string;
  createdAt: string;
  sections: number;
};

/** Restaure une révision publiée EN BROUILLON (rien ne part en ligne). */
export async function restoreRevision(formData: FormData): Promise<PageActionResult> {
  try {
    const { staff, service } = await requireStaffService();
    const revisionId = String(formData.get("revisionId") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!FALLBACK_PAGES[slug]) throw new ActionError(`Page inconnue : ${slug}`);
    const pageId = await getPageId(service, slug);

    const { data: revision } = await service
      .from("revisions")
      .select("id, snapshot")
      .eq("id", revisionId)
      .eq("entity_type", "page")
      .eq("entity_id", pageId)
      .maybeSingle();
    if (!revision) throw new ActionError("Révision introuvable.");

    const snapshot = revision.snapshot as {
      sections?: { section_key: string; content: unknown }[];
    };
    for (const section of snapshot.sections ?? []) {
      await service
        .from("page_sections")
        .update({ draft: section.content, updated_by: staff.id })
        .eq("page_id", pageId)
        .eq("section_key", section.section_key);
    }

    await logAudit({
      action: "page.restore_revision",
      entityType: "pages",
      entityId: pageId,
      diff: { slug, revisionId },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    return {
      ok: true,
      message:
        "Révision restaurée en brouillon — vérifiez puis publiez pour la remettre en ligne.",
    };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
