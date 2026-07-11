"use server";

import sharp from "sharp";
import {
  requireStaffService,
  requireAdminService,
  ActionError,
  type GuardedContext,
} from "@/lib/admin/guards";
import { logAudit } from "@/lib/audit";

/* ============================================================
   Actions de la médiathèque. Upload/édition = staff, suppression
   = admin (aligné RLS). Toutes les écritures passent par le
   service client APRÈS garde — les policies storage/table restent
   la ceinture de sécurité.
   Les images publiées référencent l'URL publique du bucket : pas
   de tag de cache dédié aux médias, mais la suppression est
   bloquée tant qu'une référence existe (anti image cassée).
   ============================================================ */

/** Formats acceptés (raster uniquement — pas de SVG : risque XSS). */
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo par fichier

/** Nom de fichier → segment de chemin sûr (minuscule, ascii, tirets). */
function safeName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return (
    base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  );
}

function safeFolder(folder: string): string | null {
  const clean = folder
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-/]+|[-/]+$/g, "")
    .slice(0, 80);
  return clean || null;
}

export type UploadResult = {
  ok: boolean;
  uploaded: number;
  errors: string[];
};

/** Téléverse un ou plusieurs fichiers vers le bucket `media`. */
export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  const { staff, service } = await requireStaffService();

  const folder = safeFolder(String(formData.get("folder") ?? ""));
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    throw new ActionError("Aucun fichier sélectionné.");
  }

  const errors: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      errors.push(`${file.name} : format non accepté (${file.type || "inconnu"}).`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name} : dépasse 10 Mo.`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    /* Dimensions réelles — refuse aussi les fichiers qui ne sont pas
       de vraies images (sharp échoue → rejet). */
    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      errors.push(`${file.name} : fichier image illisible.`);
      continue;
    }

    const path = `${folder ? `${folder}/` : ""}${Date.now()}-${safeName(file.name)}.${ext}`;

    const { error: uploadError } = await service.storage
      .from("media")
      .upload(path, buffer, { contentType: file.type });
    if (uploadError) {
      errors.push(`${file.name} : ${uploadError.message}`);
      continue;
    }

    const url = service.storage.from("media").getPublicUrl(path).data.publicUrl;

    const { error: insertError } = await service.from("media").insert({
      bucket: "media",
      path,
      url,
      alt: "",
      mime: file.type,
      size_bytes: file.size,
      width,
      height,
      folder,
      created_by: staff.id,
    });
    if (insertError) {
      /* Row impossible → on retire l'objet orphelin du Storage. */
      await service.storage.from("media").remove([path]);
      errors.push(`${file.name} : ${insertError.message}`);
      continue;
    }

    uploaded += 1;
  }

  if (uploaded > 0) {
    await logAudit({
      action: "media.upload",
      entityType: "media",
      diff: { uploaded, folder },
      actorId: staff.id,
      actorEmail: staff.email,
    });
  }

  return { ok: errors.length === 0, uploaded, errors };
}

/** Met à jour les métadonnées (alt/title) d'un média.
 *  NB : l'alt est COPIÉ dans les contenus qui référencent l'image
 *  (sections, articles) — les copies existantes ne sont pas resynchronisées. */
export async function updateMediaMeta(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff, service } = await requireStaffService();

  const alt = String(formData.get("alt") ?? "").slice(0, 300);
  const title = String(formData.get("title") ?? "").slice(0, 200) || null;

  const { error } = await service
    .from("media")
    .update({ alt, title })
    .eq("id", id);
  if (error) throw new ActionError(`Mise à jour impossible : ${error.message}`);

  await logAudit({
    action: "media.update",
    entityType: "media",
    entityId: id,
    diff: { alt, title },
    actorId: staff.id,
    actorEmail: staff.email,
  });
}

/** Références d'un média dans le contenu (bloque la suppression).
 *  Les ImageRef sont COPIÉS dans les jsonb (sections, corps d'articles) :
 *  on scanne les payloads en mémoire — les tables de contenu restent
 *  petites (dizaines de rows), un LIKE SQL n'apporterait rien. */
async function countReferences(
  service: GuardedContext["service"],
  id: string,
  path: string,
): Promise<string[]> {
  const used: string[] = [];
  const matches = (payload: unknown) => {
    const text = JSON.stringify(payload ?? "");
    return text.includes(id) || text.includes(path);
  };

  const [covers, avatars, sections, posts] = await Promise.all([
    service.from("posts").select("id", { count: "exact", head: true }).eq("cover_media_id", id),
    service
      .from("testimonials")
      .select("id", { count: "exact", head: true })
      .eq("avatar_media_id", id),
    service.from("page_sections").select("id, content, draft"),
    service.from("posts").select("id, body"),
  ]);

  const sectionHits = (sections.data ?? []).filter(
    (row) => matches(row.content) || matches(row.draft),
  ).length;
  const bodyHits = (posts.data ?? []).filter((row) => matches(row.body)).length;

  if (covers.count) used.push(`${covers.count} couverture(s) d'article`);
  if (avatars.count) used.push(`${avatars.count} avatar(s) de témoignage`);
  if (sectionHits) used.push(`${sectionHits} section(s) de page`);
  if (bodyHits) used.push(`${bodyHits} corps d'article(s)`);
  return used;
}

/** Supprime un média (admin) — refuse s'il est encore référencé. */
export async function deleteMedia(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { staff, service } = await requireAdminService();

  const { data: media } = await service
    .from("media")
    .select("id, bucket, path")
    .eq("id", id)
    .maybeSingle();
  if (!media) throw new ActionError("Média introuvable.");

  const used = await countReferences(service, media.id, media.path);
  if (used.length > 0) {
    throw new ActionError(
      `Suppression impossible : image encore utilisée (${used.join(", ")}).`,
    );
  }

  if (media.bucket === "media") {
    const { error: removeError } = await service.storage
      .from("media")
      .remove([media.path]);
    if (removeError) {
      throw new ActionError(`Storage : ${removeError.message}`);
    }
  }
  /* bucket 'legacy' : fichier de /public/images, on ne supprime que la row. */

  const { error } = await service.from("media").delete().eq("id", id);
  if (error) throw new ActionError(`Suppression impossible : ${error.message}`);

  await logAudit({
    action: "media.delete",
    entityType: "media",
    entityId: id,
    diff: { path: media.path, bucket: media.bucket },
    actorId: staff.id,
    actorEmail: staff.email,
  });
}

export type MediaRow = {
  id: string;
  bucket: string;
  path: string;
  url: string | null;
  alt: string;
  title: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  folder: string | null;
  created_at: string;
};

/** Recherche paginée pour la médiathèque et l'ImagePicker (staff). */
export async function searchMedia(input: {
  q?: string;
  folder?: string;
  page?: number;
}): Promise<{ rows: MediaRow[]; total: number; folders: string[] }> {
  const { service } = await requireStaffService();

  const page = Math.max(0, input.page ?? 0);
  const PER_PAGE = 40;

  let query = service
    .from("media")
    .select("id, bucket, path, url, alt, title, mime, width, height, folder, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);

  if (input.q) {
    const q = input.q.replace(/[%_]/g, "");
    query = query.or(`path.ilike.%${q}%,alt.ilike.%${q}%,title.ilike.%${q}%`);
  }
  if (input.folder) query = query.eq("folder", input.folder);

  const { data, count, error } = await query;
  if (error) throw new ActionError(error.message);

  const { data: folderRows } = await service
    .from("media")
    .select("folder")
    .not("folder", "is", null);
  const folders = [...new Set((folderRows ?? []).map((r) => r.folder as string))].sort();

  return { rows: (data ?? []) as MediaRow[], total: count ?? 0, folders };
}
