import type { Metadata } from "next";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import MediaLibrary from "@/components/admin/media/MediaLibrary";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Médias" };

/* Médiathèque : les données sont chargées côté client via la server
   action searchMedia (pagination, recherche) — la page ne fait que
   poser le cadre et transmettre le rôle (suppression admin-only). */
export default async function AdminMediasPage() {
  const staff = await requireStaff();
  const isAdmin = await getIsAdmin(staff);

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Médias</h1>
        <p className={s.pageDesc}>
          Bibliothèque d&apos;images du site : téléversez, renseignez les
          textes alternatifs et organisez par dossier. L&apos;alt saisi ici
          est proposé par défaut quand l&apos;image est insérée dans un
          contenu (les contenus existants gardent leur propre alt).
        </p>
      </header>
      <MediaLibrary canDelete={isAdmin} />
    </>
  );
}
