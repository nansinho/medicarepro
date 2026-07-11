import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";
import PostEditor from "@/components/admin/blog/PostEditor";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Modifier l'article" };

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = serviceClient();
  if (!service) notFound();

  const { data: post } = await service
    .from("posts")
    .select(
      "id, title, slug, excerpt, cover_media_id, cover_alt, body, status, scheduled_for, published_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  /* URL de la couverture pour l'aperçu du champ image. */
  let coverPath = "";
  if (post.cover_media_id) {
    const { data: media } = await service
      .from("media")
      .select("url, path")
      .eq("id", post.cover_media_id)
      .maybeSingle();
    coverPath = media?.url ?? media?.path ?? "";
  }

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Modifier l&apos;article</h1>
      </header>
      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          coverMediaId: post.cover_media_id,
          coverPath,
          coverAlt: post.cover_alt ?? "",
          body: (post.body ?? { type: "doc", content: [] }) as Record<string, unknown>,
          status: post.status,
          scheduledFor: post.scheduled_for,
          publishedAt: post.published_at,
        }}
      />
    </>
  );
}
