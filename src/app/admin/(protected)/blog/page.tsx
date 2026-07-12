import type { Metadata } from "next";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";
import { Plus } from "@/components/icons";
import BlogList, {
  type BlogListRow,
} from "@/components/admin/blog/BlogList";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Actualités" };

export default async function AdminBlogListPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Actualités</h1>
        </header>
        <p className={s.banner}>Supabase non configuré.</p>
      </>
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
    <>
      <header className={s.pageHead}>
        <div className={s.pageHeadRow}>
          <div>
            <h1 className={s.pageTitle}>Actualités</h1>
            <p className={s.pageDesc}>Articles du blog du site.</p>
          </div>
          <Link href="/admin/blog/nouveau" className={s.primaryBtn}>
            <Plus width={15} height={15} /> Nouvel article
          </Link>
        </div>
      </header>

      <BlogList rows={rows} />
    </>
  );
}
