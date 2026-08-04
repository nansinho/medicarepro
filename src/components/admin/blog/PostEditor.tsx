"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, Save, Trash2 } from "lucide-react";
import {
  changePostStatus,
  deletePost,
  savePost,
  type PostStatus,
} from "@/app/admin/(protected)/blog/actions";
import RichTextEditor from "@/components/admin/rich-text/RichTextEditor";
import ImagePicker from "@/components/admin/media/ImagePicker";
import { useToast } from "@/components/admin/ui/Toast";
import { PageHeading } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

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

const STATUS_VARIANT: Record<string, "green" | "amber" | "blue" | "gray"> = {
  draft: "gray",
  needs_review: "amber",
  approved: "blue",
  scheduled: "blue",
  published: "green",
  archived: "gray",
};

const scheduleFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function PostEditor({
  post,
  heading,
}: {
  post: PostEditorData;
  heading: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

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
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        if (!post.id) router.replace(`/admin/blog/${result.id}`);
        else router.refresh();
      } else {
        toast.error(result.message);
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
        toast.error(saved.message);
        return;
      }
      const formData = new FormData();
      formData.set("id", saved.id);
      formData.set("status", status);
      if (status === "scheduled") formData.set("scheduledFor", scheduleAt);
      const result = await changePostStatus(formData);
      if (result.ok) {
        toast.success(result.message ?? "Statut mis à jour.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
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
        toast.success("Article supprimé.");
        router.push("/admin/blog");
      } else {
        toast.error(result.message);
      }
    });
  }

  const isPublished = post.status === "published";
  const canPublish = Boolean(post.id) && !isPublished;

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title={heading}
        description="Métadonnées, couverture et corps de l'article."
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/blog">
                <ArrowLeft />
                Articles
              </Link>
            </Button>
            <Button
              type="button"
              variant={canPublish ? "outline" : "default"}
              size="sm"
              disabled={pending}
              onClick={handleSave}
            >
              <Save />
              {pending ? "En cours…" : "Enregistrer"}
            </Button>
            {canPublish && (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => handleStatus("published")}
              >
                Publier maintenant
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Colonne principale : titre + corps */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-title">Titre</Label>
            <Input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'article"
              className="h-11 text-lg font-semibold md:text-lg"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Contenu</Label>
            <RichTextEditor value={body} onChange={setBody} variant="blog" />
          </div>
        </div>

        {/* Colonne latérale : statut + métadonnées */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Statut</CardTitle>
              <Badge variant={STATUS_VARIANT[post.status] ?? "gray"}>
                {STATUS_LABELS[post.status] ?? post.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {post.status === "scheduled" && post.scheduledFor && (
                <p className="text-xs text-muted-foreground">
                  Programmé le {scheduleFmt.format(new Date(post.scheduledFor))}
                </p>
              )}

              {canPublish && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schedule-at" className="text-xs text-muted-foreground">
                    Programmer la publication
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="schedule-at"
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      aria-label="Date de publication programmée"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || !scheduleAt}
                      onClick={() => handleStatus("scheduled")}
                    >
                      Programmer
                    </Button>
                  </div>
                </div>
              )}

              {post.id && isPublished && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleStatus("draft")}
                >
                  Dépublier (repasser en brouillon)
                </Button>
              )}

              {post.id && post.status !== "archived" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleStatus("archived")}
                >
                  Archiver
                </Button>
              )}

              {post.id && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" asChild className="justify-start">
                      <Link href={`/admin/blog/${post.id}/apercu`} target="_blank">
                        <Eye />
                        Aperçu de l&apos;article
                      </Link>
                    </Button>
                    {isPublished && (
                      <Button variant="ghost" size="sm" asChild className="justify-start">
                        <Link href={`/blog/${post.slug}`} target="_blank">
                          <ExternalLink />
                          Voir sur le site
                        </Link>
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Référencement</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="post-slug">Slug (URL)</Label>
                <Input
                  id="post-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="genere-depuis-le-titre"
                />
                <p className="text-xs text-muted-foreground">
                  /blog/{slug || "…"}
                  {isPublished
                    ? " (un changement crée automatiquement une redirection)."
                    : ""}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="post-excerpt">Résumé (extrait + meta description)</Label>
                <Textarea
                  id="post-excerpt"
                  rows={4}
                  maxLength={300}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {excerpt.length}/300
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Couverture</CardTitle>
            </CardHeader>
            <CardContent>
              <ImagePicker value={cover} onChange={setCover} label="Image de couverture" />
            </CardContent>
          </Card>

          {post.id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={handleDelete}
              className="justify-start text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 />
              Supprimer l&apos;article
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
