"use server";

import { updateTag } from "next/cache";
import {
  requireStaffService,
  requireAdminService,
  ActionError,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cms/tags";

/* ============================================================
   Actions du module Actualités. Création/édition/publication =
   staff (les éditeurs publient — décision client), suppression =
   admin. Chaque écriture : garde → validation → écriture →
   audit → invalidation des tags (updateTag, Next 16).
   Renommage du slug d'un article publié → redirection 301
   automatique (perte SEO sinon).
   ============================================================ */

const STATUSES = [
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;
export type PostStatus = (typeof STATUSES)[number];

export type PostActionResult =
  | { ok: true; id: string; message?: string }
  | { ok: false; message: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] };

function isDoc(value: unknown): value is { type: "doc"; content: TiptapNode[] } {
  return (
    value != null &&
    typeof value === "object" &&
    (value as TiptapNode).type === "doc" &&
    Array.isArray((value as TiptapNode).content)
  );
}

/** Temps de lecture : ~220 mots/min sur le texte du document. */
function readingTime(doc: { content: TiptapNode[] }): number {
  let words = 0;
  const walk = (node: TiptapNode) => {
    if (typeof node.text === "string") {
      words += node.text.split(/\s+/).filter(Boolean).length;
    }
    for (const child of node.content ?? []) walk(child);
  };
  for (const node of doc.content) walk(node);
  return Math.max(1, Math.round(words / 220));
}

function invalidatePost(slug: string, previousSlug?: string) {
  updateTag(TAGS.posts);
  updateTag(TAGS.post(slug));
  if (previousSlug && previousSlug !== slug) updateTag(TAGS.post(previousSlug));
  updateTag(TAGS.sitemap);
}

/** Crée ou met à jour un article (sans changer son statut). */
export async function savePost(formData: FormData): Promise<PostActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) throw new ActionError("Le titre est obligatoire.");

    const slug = slugify(String(formData.get("slug") ?? "")) || slugify(title);
    if (!slug) throw new ActionError("Slug invalide.");

    const excerpt = String(formData.get("excerpt") ?? "").trim().slice(0, 300);
    const coverMediaId = String(formData.get("coverMediaId") ?? "") || null;
    const coverAlt = String(formData.get("coverAlt") ?? "").trim().slice(0, 300);

    let body: unknown;
    try {
      body = JSON.parse(String(formData.get("body") ?? "null"));
    } catch {
      throw new ActionError("Corps de l'article illisible.");
    }
    if (!isDoc(body)) throw new ActionError("Corps de l'article invalide.");

    const payload = {
      title,
      slug,
      excerpt,
      cover_media_id: coverMediaId,
      cover_alt: coverAlt,
      body,
      reading_time_min: readingTime(body),
    };

    if (!id) {
      /* Création : brouillon, auteur = staff courant. */
      const { data, error } = await service
        .from("posts")
        .insert({ ...payload, status: "draft", author_id: staff.id, origin: "manual" })
        .select("id")
        .single();
      if (error) {
        throw new ActionError(
          /duplicate|unique/i.test(error.message)
            ? `Le slug « ${slug} » est déjà utilisé par un autre article.`
            : `Création impossible : ${error.message}`,
        );
      }
      await logAudit({
        action: "post.create",
        entityType: "posts",
        entityId: data.id,
        diff: { title, slug },
        actorId: staff.id,
        actorEmail: staff.email,
      });
      invalidatePost(slug);
      return { ok: true, id: data.id, message: "Brouillon créé." };
    }

    /* Mise à jour : détecter un renommage de slug d'article publié. */
    const { data: existing } = await service
      .from("posts")
      .select("slug, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) throw new ActionError("Article introuvable.");

    const { error } = await service.from("posts").update(payload).eq("id", id);
    if (error) {
      throw new ActionError(
        /duplicate|unique/i.test(error.message)
          ? `Le slug « ${slug} » est déjà utilisé par un autre article.`
          : `Enregistrement impossible : ${error.message}`,
      );
    }

    if (existing.status === "published" && existing.slug !== slug) {
      /* Redirection 301 automatique ancien → nouveau (SEO). */
      await service.from("redirects").upsert(
        {
          from_path: `/blog/${existing.slug}`,
          to_path: `/blog/${slug}`,
          status_code: 301,
          is_active: true,
        },
        { onConflict: "from_path" },
      );
      updateTag(TAGS.redirects);
    }

    await logAudit({
      action: "post.update",
      entityType: "posts",
      entityId: id,
      diff: { title, slug },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidatePost(slug, existing.slug);
    return { ok: true, id, message: "Enregistré." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Change le statut (workflow draft → … → published/scheduled → archived). */
export async function changePostStatus(
  formData: FormData,
): Promise<PostActionResult> {
  try {
    const { staff, service } = await requireStaffService();

    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "") as PostStatus;
    if (!id) throw new ActionError("Article manquant.");
    if (!STATUSES.includes(status)) throw new ActionError("Statut inconnu.");

    const { data: post } = await service
      .from("posts")
      .select("id, slug, title, status, published_at, body, excerpt, cover_media_id, cover_alt")
      .eq("id", id)
      .maybeSingle();
    if (!post) throw new ActionError("Article introuvable.");

    const patch: Record<string, unknown> = { status };

    if (status === "scheduled") {
      const scheduledFor = String(formData.get("scheduledFor") ?? "");
      const when = new Date(scheduledFor);
      if (!scheduledFor || Number.isNaN(when.getTime())) {
        throw new ActionError("Date de programmation invalide.");
      }
      if (when.getTime() <= Date.now()) {
        throw new ActionError("La date de programmation doit être dans le futur.");
      }
      patch.scheduled_for = when.toISOString();
      /* Le cron posera published_at à l'heure de publication. */
    }

    if (status === "published") {
      patch.published_at = post.published_at ?? new Date().toISOString();
      patch.scheduled_for = null;
      /* Snapshot de publication (rollback 1 clic). */
      await service.from("revisions").insert({
        entity_type: "post",
        entity_id: post.id,
        snapshot: post,
        created_by: staff.id,
      });
    }

    const { error } = await service.from("posts").update(patch).eq("id", id);
    if (error) throw new ActionError(`Changement impossible : ${error.message}`);

    await logAudit({
      action: `post.status.${status}`,
      entityType: "posts",
      entityId: id,
      diff: { from: post.status, to: status },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidatePost(post.slug);

    const MESSAGES: Partial<Record<PostStatus, string>> = {
      published: "Article publié — en ligne immédiatement.",
      scheduled: "Publication programmée.",
      archived: "Article archivé (retiré du site).",
      draft: "Repassé en brouillon (retiré du site).",
    };
    return { ok: true, id, message: MESSAGES[status] ?? "Statut mis à jour." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}

/** Suppression définitive (admin) — préférer l'archivage. */
export async function deletePost(formData: FormData): Promise<PostActionResult> {
  try {
    const { staff, service } = await requireAdminService();

    const id = String(formData.get("id") ?? "");
    if (!id) throw new ActionError("Article manquant.");

    const { data: post } = await service
      .from("posts")
      .select("slug, title")
      .eq("id", id)
      .maybeSingle();
    if (!post) throw new ActionError("Article introuvable.");

    const { error } = await service.from("posts").delete().eq("id", id);
    if (error) throw new ActionError(`Suppression impossible : ${error.message}`);

    await logAudit({
      action: "post.delete",
      entityType: "posts",
      entityId: id,
      diff: { slug: post.slug, title: post.title },
      actorId: staff.id,
      actorEmail: staff.email,
    });
    invalidatePost(post.slug);
    return { ok: true, id, message: "Article supprimé." };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message };
    throw err;
  }
}
