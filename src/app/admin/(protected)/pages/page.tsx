import type { Metadata } from "next";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/service";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { segmentForSlug } from "@/lib/admin/pageRoutes";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pages" };

export default async function AdminPagesListPage() {
  const service = serviceClient();

  /* Brouillons en attente par page (badge). */
  const draftCounts = new Map<string, number>();
  const updatedAt = new Map<string, string>();
  if (service) {
    const { data } = await service
      .from("pages")
      .select("slug, page_sections(section_key, draft, updated_at)");
    for (const page of data ?? []) {
      const sections = (page.page_sections ?? []) as {
        draft: unknown;
        updated_at: string | null;
      }[];
      draftCounts.set(
        page.slug,
        sections.filter((section) => section.draft != null).length,
      );
      const latest = sections
        .map((section) => section.updated_at)
        .filter(Boolean)
        .sort()
        .pop();
      if (latest) updatedAt.set(page.slug, latest);
    }
  }

  const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Pages du site</h1>
          <p className={s.pageDesc}>Textes et visuels de chaque page du site.</p>
        </div>
      </header>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Page</th>
              <th>URL</th>
              <th>Sections</th>
              <th>Brouillon</th>
              <th>Dernière modification</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(FALLBACK_PAGES).map((page) => {
              const drafts = draftCounts.get(page.slug) ?? 0;
              const last = updatedAt.get(page.slug);
              return (
                <tr key={page.slug}>
                  <td>
                    <Link
                      href={`/admin/pages/${segmentForSlug(page.slug)}`}
                      className={s.tdMain}
                    >
                      {page.title}
                    </Link>
                  </td>
                  <td>
                    <span className={s.tdSub}>{page.slug}</span>
                  </td>
                  <td>
                    <span className={s.tdSub}>{page.sections.length}</span>
                  </td>
                  <td>
                    {drafts > 0 ? (
                      <span className={`${s.badge} ${s.tAmber}`}>
                        {drafts} non publiée{drafts > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className={s.tdSub}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={s.tdSub}>
                      {last ? DATE_FMT.format(new Date(last)) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
