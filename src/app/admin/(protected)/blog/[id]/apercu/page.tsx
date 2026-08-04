import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import RichTextRenderer, {
  type RichTextBody,
} from "@/components/cms/RichTextRenderer";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aperçu de l'article" };

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

/* Typographie de lecture : rendu fidèle sans le plugin prose. */
const ARTICLE_PROSE = [
  "text-[15px] leading-7 text-muted-foreground",
  "[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground",
  "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:my-4",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5",
  "[&_blockquote]:my-5 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary [&_blockquote]:bg-secondary/60 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:not-italic [&_blockquote]:text-foreground",
  "[&_a]:text-primary [&_a]:underline",
  "[&_img]:my-6 [&_img]:w-full [&_img]:rounded-xl",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
].join(" ");

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
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Aperçu de l'article"
        description="Relecture avec le gabarit exact du site public."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/blog/${id}`}>
              <ArrowLeft />
              Retour à l&apos;édition
            </Link>
          </Button>
        }
      />

      <Notice tone="info" title="Aperçu de relecture">
        Statut actuel :{" "}
        <Badge variant={STATUS_VARIANT[post.status] ?? "gray"}>
          {STATUS_LABELS[post.status] ?? post.status}
        </Badge>
        . Ce rendu utilise exactement le gabarit du site.
      </Notice>

      <Card className="mx-auto w-full max-w-3xl">
        <CardContent className="p-6 sm:p-8">
          <article className={ARTICLE_PROSE}>
            <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-foreground">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mb-6 text-lg italic text-muted-foreground">{post.excerpt}</p>
            )}
            {coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- aperçu admin */
              <img
                src={coverUrl}
                alt={post.cover_alt ?? ""}
                className="mb-6 w-full rounded-xl"
              />
            )}
            <RichTextRenderer
              body={(post.body ?? { type: "doc", content: [] }) as RichTextBody}
              variant="blog"
            />
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
