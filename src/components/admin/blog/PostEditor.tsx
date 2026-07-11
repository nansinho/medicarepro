"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  changePostStatus,
  deletePost,
  savePost,
  type PostActionResult,
  type PostStatus,
} from "@/app/admin/(protected)/blog/actions";
import RichTextEditor from "@/components/admin/rich-text/RichTextEditor";
import ImagePicker from "@/components/admin/media/ImagePicker";
import s from "../Admin.module.css";
import b from "./blog.module.css";

/* ============================================================
   Éditeur d'article : métadonnées + couverture + corps riche +
   barre de statut (workflow). Enregistrement explicite ; les
   changements de statut passent par changePostStatus.
   ============================================================ */

export type PostEditorData = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  coverMediaId: string | null;
  coverPath: string;
  coverAlt: string;
  body: Record<string, unknown>;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  needs_review: "En relecture",
  approved: "Approuvé",
  scheduled: "Programmé",
  published: "Publié",
  archived: "Archivé",
};

export default function PostEditor({ post }: { post: PostEditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<PostActionResult | null>(null);

  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [cover, setCover] = useState({
    mediaId: post.coverMediaId,
    path: post.coverPath,
    alt: post.coverAlt,
  });
  const [body, setBody] = useState(post.body);
  const [scheduleAt, setScheduleAt] = useState("");

  function buildFormData(): FormData {
    const formData = new FormData();
    if (post.id) formData.set("id", post.id);
    formData.set("title", title);
    formData.set("slug", slug);
    formData.set("excerpt", excerpt);
    formData.set("coverMediaId", cover.mediaId ?? "");
    formData.set("coverAlt", cover.alt);
    formData.set("body", JSON.stringify(body));
    return formData;
  }

  function handleSave() {
    startTransition(async () => {
      const result = await savePost(buildFormData());
      setNotice(result);
      if (result.ok && !post.id) {
        router.replace(`/admin/blog/${result.id}`);
      } else if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleStatus(status: PostStatus) {
    startTransition(async () => {
      /* Enregistrer d'abord les modifications en cours. */
      const saved = post.id
        ? await savePost(buildFormData())
        : { ok: false as const, message: "Enregistrez l'article d'abord." };
      if (!saved.ok) {
        setNotice(saved);
        return;
      }
      const formData = new FormData();
      formData.set("id", saved.id);
      formData.set("status", status);
      if (status === "scheduled") formData.set("scheduledFor", scheduleAt);
      const result = await changePostStatus(formData);
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  function handleDelete() {
    if (!post.id) return;
    if (!window.confirm("Supprimer définitivement cet article ?")) return;
    const formData = new FormData();
    formData.set("id", post.id);
    startTransition(async () => {
      const result = await deletePost(formData);
      if (result.ok) {
        router.push("/admin/blog");
      } else {
        setNotice(result);
      }
    });
  }

  const isPublished = post.status === "published";

  return (
    <div className={b.layout}>
      {/* Colonne principale : titre + corps */}
      <div className={b.mainCol}>
        <label className={b.field}>
          <span>Titre</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'article"
          />
        </label>

        <RichTextEditor value={body} onChange={setBody} variant="blog" />
      </div>

      {/* Colonne latérale : statut + métadonnées */}
      <aside className={b.sideCol}>
        <section className={b.panel}>
          <h2>Statut</h2>
          <p className={b.statusLine}>
            <span className={`${s.badge} ${isPublished ? s.tGreen : s.tGray}`}>
              {STATUS_LABELS[post.status] ?? post.status}
            </span>
            {post.status === "scheduled" && post.scheduledFor && (
              <small>
                le{" "}
                {new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(post.scheduledFor))}
              </small>
            )}
          </p>

          <div className={b.statusActions}>
            <button
              type="button"
              className={b.primary}
              disabled={pending}
              onClick={handleSave}
            >
              {pending ? "En cours…" : "Enregistrer"}
            </button>

            {post.id && !isPublished && (
              <button
                type="button"
                className={b.publish}
                disabled={pending}
                onClick={() => handleStatus("published")}
              >
                Publier maintenant
              </button>
            )}

            {post.id && !isPublished && (
              <div className={b.scheduleRow}>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  aria-label="Date de publication programmée"
                />
                <button
                  type="button"
                  disabled={pending || !scheduleAt}
                  onClick={() => handleStatus("scheduled")}
                >
                  Programmer
                </button>
              </div>
            )}

            {post.id && isPublished && (
              <button
                type="button"
                className={b.secondary}
                disabled={pending}
                onClick={() => handleStatus("draft")}
              >
                Dépublier (brouillon)
              </button>
            )}

            {post.id && post.status !== "archived" && (
              <button
                type="button"
                className={b.secondary}
                disabled={pending}
                onClick={() => handleStatus("archived")}
              >
                Archiver
              </button>
            )}
          </div>

          {post.id && (
            <div className={b.sideLinks}>
              <Link href={`/admin/blog/${post.id}/apercu`} target="_blank">
                Aperçu de l&apos;article ↗
              </Link>
              {isPublished && (
                <Link href={`/blog/${post.slug}`} target="_blank">
                  Voir sur le site ↗
                </Link>
              )}
            </div>
          )}
        </section>

        <section className={b.panel}>
          <h2>Référencement</h2>
          <label className={b.field}>
            <span>Slug (URL)</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="genere-depuis-le-titre"
            />
            <small>
              /blog/{slug || "…"}
              {isPublished
                ? " — un changement crée automatiquement une redirection."
                : ""}
            </small>
          </label>
          <label className={b.field}>
            <span>Résumé (extrait + meta description)</span>
            <textarea
              rows={4}
              maxLength={300}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
            <small>{excerpt.length}/300</small>
          </label>
        </section>

        <section className={b.panel}>
          <h2>Couverture</h2>
          <ImagePicker
            value={cover}
            onChange={setCover}
            label="Image de couverture"
          />
        </section>

        {post.id && (
          <button
            type="button"
            className={b.danger}
            disabled={pending}
            onClick={handleDelete}
          >
            Supprimer l&apos;article
          </button>
        )}
      </aside>

      {notice && (
        <div
          className={`${b.notice} ${notice.ok ? b.noticeOk : b.noticeErr}`}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.ok ? notice.message ?? "OK" : notice.message}
        </div>
      )}
    </div>
  );
}
