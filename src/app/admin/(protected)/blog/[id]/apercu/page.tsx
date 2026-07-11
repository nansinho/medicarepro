import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";
import RichTextRenderer, {
  type RichTextBody,
} from "@/components/cms/RichTextRenderer";
import a from "@/components/article.module.css";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aperçu de l'article" };

/* Aperçu staff d'un article (y compris brouillon) : le corps est rendu
   avec le MÊME renderer que le site public (variant blog) — la relecture
   voit exactement ce qui sera publié. */
export default async function AdminBlogApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = serviceClient();
  if (!service) notFound();

  const { data: post } = await service
    .from("posts")
    .select("title, excerpt, body, status, cover_media_id, cover_alt")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  let coverUrl = "";
  if (post.cover_media_id) {
    const { data: media } = await service
      .from("media")
      .select("url")
      .eq("id", post.cover_media_id)
      .maybeSingle();
    coverUrl = media?.url ?? "";
  }

  return (
    <>
      <p className={s.banner}>
        Aperçu de relecture — statut actuel :{" "}
        <b>{post.status}</b>. Ce rendu utilise exactement le gabarit du site.
      </p>
      <article className={a.body} style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: "1.9rem", lineHeight: 1.2 }}>{post.title}</h1>
        {post.excerpt && <p><em>{post.excerpt}</em></p>}
        {coverUrl && (
          /* eslint-disable-next-line @next/next/no-img-element -- aperçu admin */
          <img
            src={coverUrl}
            alt={post.cover_alt ?? ""}
            style={{ width: "100%", borderRadius: 14 }}
          />
        )}
        <RichTextRenderer
          body={(post.body ?? { type: "doc", content: [] }) as RichTextBody}
          variant="blog"
        />
      </article>
    </>
  );
}
