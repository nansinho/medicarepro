import type { Metadata } from "next";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";
import { Plus } from "@/components/icons";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Actualités" };

const STATUS_BADGES: Record<string, { label: string; tone: string }> = {
  draft: { label: "Brouillon", tone: "tGray" },
  needs_review: { label: "En relecture", tone: "tAmber" },
  approved: { label: "Approuvé", tone: "tBlue" },
  scheduled: { label: "Programmé", tone: "tBlue" },
  published: { label: "Publié", tone: "tGreen" },
  archived: { label: "Archivé", tone: "tGray" },
};

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
    .select("id, title, slug, status, published_at, scheduled_for, updated_at, origin")
    .order("updated_at", { ascending: false });

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Actualités</h1>
          <p className={s.pageDesc}>
            Articles du blog : rédaction, relecture, publication (immédiate ou
            programmée).
          </p>
        </div>
        <Link href="/admin/blog/nouveau" className={s.primaryBtn}>
          <Plus width={15} height={15} /> Nouvel article
        </Link>
      </header>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Article</th>
              <th>Statut</th>
              <th>Publication</th>
              <th>Dernière modification</th>
            </tr>
          </thead>
          <tbody>
            {(posts ?? []).map((post) => {
              const badge = STATUS_BADGES[post.status] ?? STATUS_BADGES.draft;
              return (
                <tr key={post.id}>
                  <td>
                    <Link href={`/admin/blog/${post.id}`} className={s.tdMain}>
                      {post.title}
                    </Link>
                    <span className={s.tdSub}>
                      /blog/{post.slug}
                      {post.origin === "ai" ? " · généré par IA" : ""}
                    </span>
                  </td>
                  <td>
                    <span className={`${s.badge} ${s[badge.tone as keyof typeof s]}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <span className={s.tdSub}>
                      {post.status === "scheduled" && post.scheduled_for
                        ? `le ${DATE_FMT.format(new Date(post.scheduled_for))}`
                        : post.published_at
                          ? DATE_FMT.format(new Date(post.published_at))
                          : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={s.tdSub}>
                      {post.updated_at
                        ? DATE_FMT.format(new Date(post.updated_at))
                        : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(posts ?? []).length === 0 && (
              <tr>
                <td colSpan={4}>
                  <span className={s.tdSub}>
                    Aucun article — créez le premier.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
