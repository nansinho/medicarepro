import type { Metadata } from "next";
import { serverClient } from "@/lib/supabase/server";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Contenu du site — comptages du CMS (pages, blog, médias…).
   Lectures via la session staff (RLS is_staff), en count-only :
   l'accès est déjà gardé par le layout du groupe (protected).
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contenu du site" };

async function countRows(
  sb: NonNullable<Awaited<ReturnType<typeof serverClient>>>,
  table: string,
  filter?: { column: string; value: string },
): Promise<number> {
  let query = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export default async function AdminContenuPage() {
  const sb = await serverClient();

  if (!sb) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Contenu du site</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : les comptages du contenu sont indisponibles
          sur cet environnement.
        </p>
      </>
    );
  }

  const [
    pages,
    posts,
    testimonials,
    media,
    citiesTotal,
    citiesPublished,
    contactRequests,
    newsletter,
  ] = await Promise.all([
    countRows(sb, "pages"),
    countRows(sb, "posts", { column: "status", value: "published" }),
    countRows(sb, "testimonials"),
    countRows(sb, "media"),
    countRows(sb, "cities"),
    countRows(sb, "cities", { column: "status", value: "published" }),
    countRows(sb, "contact_requests"),
    countRows(sb, "newsletter_subscribers"),
  ]);

  const stats = [
    { label: "Pages gérées", value: pages, hint: "Vitrine + pages légales" },
    { label: "Articles publiés", value: posts, hint: "Blog du site" },
    { label: "Témoignages", value: testimonials, hint: "Avis affichés sur le site" },
    { label: "Médias", value: media, hint: "Bibliothèque d'images" },
    {
      label: "Villes SEO publiées",
      value: citiesPublished,
      hint: `Sur ${citiesTotal} villes préparées`,
    },
    {
      label: "Demandes de contact",
      value: contactRequests,
      hint: "Reçues via le formulaire",
    },
    {
      label: "Abonnés newsletter",
      value: newsletter,
      hint: "Inscriptions au total",
    },
  ];

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Contenu du site</h1>
        <p className={s.pageDesc}>Vue d&apos;ensemble du site en un coup d&apos;œil.</p>
      </header>

      <div className={s.kpiGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={s.kpiCard}>
            <span className={s.kpiLabel}>{stat.label}</span>
            <span className={s.kpiValue}>
              {stat.value.toLocaleString("fr-FR")}
            </span>
            <span className={s.kpiHint}>{stat.hint}</span>
          </div>
        ))}
      </div>
    </>
  );
}
