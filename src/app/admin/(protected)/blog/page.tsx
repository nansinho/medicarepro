import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import BlogList, {
  type BlogListRow,
} from "@/components/admin/blog/BlogList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Actualités" };

export default async function AdminBlogListPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Actualités" description="Articles du blog du site." />
        <Notice tone="warn" title="Supabase non configuré">
          La liste des articles est indisponible.
        </Notice>
      </div>
    );
  }

  const { data: posts } = await service
    .from("posts")
    .select(
      "id, title, slug, status, published_at, scheduled_for, updated_at, origin, reading_time_min",
    )
    .order("updated_at", { ascending: false });

  const rows: BlogListRow[] = (posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    origin: post.origin,
    readingTime: post.reading_time_min,
    publishedAt: post.published_at,
    scheduledFor: post.scheduled_for,
    updatedAt: post.updated_at,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Actualités"
        description="Articles du blog du site."
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/blog/nouveau">
              <Plus />
              Nouvel article
            </Link>
          </Button>
        }
      />

      <BlogList rows={rows} />
    </div>
  );
}
