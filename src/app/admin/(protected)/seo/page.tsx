import type { Metadata } from "next";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { SEO_DEFAULTS } from "@/data/content/site";
import SeoManager, {
  type SeoMetaRow,
  type RedirectRow,
  type NotFoundRow,
} from "@/components/admin/seo/SeoManager";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "SEO" };

export default async function AdminSeoPage() {
  const staff = await requireStaff();
  const isAdmin = await getIsAdmin(staff);
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>SEO</h1>
        </header>
        <p className={s.banner}>Supabase non configuré.</p>
      </>
    );
  }

  const [{ data: metaRows }, { data: redirectRows }, { data: notFoundRows }] =
    await Promise.all([
      service.from("seo_meta").select("*").order("path"),
      service
        .from("redirects")
        .select("id, from_path, to_path, status_code, is_active, hits, last_hit_at")
        .order("from_path"),
      service
        .from("not_found_logs")
        .select("path, hit_count, last_referer, last_seen")
        .order("hit_count", { ascending: false })
        .limit(100),
    ]);

  /* Routes gérées : défauts codés surchargés par la table. */
  const overrides = new Map(
    (metaRows ?? []).map((row: { path: string }) => [row.path, row]),
  );
  const routes: SeoMetaRow[] = Object.entries(SEO_DEFAULTS).map(
    ([path, defaults]) => {
      const row = overrides.get(path) as Record<string, unknown> | undefined;
      return {
        path,
        title: (row?.title as string) ?? defaults.title,
        titleAbsolute: Boolean(
          row?.title_absolute ?? ("titleAbsolute" in defaults ? defaults.titleAbsolute : false),
        ),
        description: (row?.description as string) ?? defaults.description,
        canonical: (row?.canonical as string) ?? defaults.canonical,
        noindex: Boolean(row?.noindex ?? false),
        sitemapInclude: Boolean(row?.sitemap_include ?? true),
        sitemapPriority: Number(row?.sitemap_priority ?? defaults.sitemapPriority),
        sitemapChangefreq: String(
          row?.sitemap_changefreq ?? defaults.sitemapChangefreq,
        ),
        overridden: Boolean(row),
      };
    },
  );
  /* + les routes déjà surchargées hors défauts (articles de blog). */
  for (const row of metaRows ?? []) {
    if (!(row.path in SEO_DEFAULTS)) {
      routes.push({
        path: row.path,
        title: row.title ?? "",
        titleAbsolute: Boolean(row.title_absolute),
        description: row.description ?? "",
        canonical: row.canonical ?? row.path,
        noindex: Boolean(row.noindex),
        sitemapInclude: Boolean(row.sitemap_include),
        sitemapPriority: Number(row.sitemap_priority ?? 0.5),
        sitemapChangefreq: String(row.sitemap_changefreq ?? "monthly"),
        overridden: true,
      });
    }
  }

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>SEO</h1>
          <p className={s.pageDesc}>
            Balises méta par page, redirections 301 et pages introuvables
            (404) signalées par les visiteurs.
          </p>
        </div>
      </header>
      <SeoManager
        routes={routes}
        redirects={(redirectRows ?? []) as RedirectRow[]}
        notFound={(notFoundRows ?? []) as NotFoundRow[]}
        isAdmin={isAdmin}
      />
    </>
  );
}
