import type { Metadata } from "next";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import MediaLibrary from "@/components/admin/media/MediaLibrary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Médias" };

/* Médiathèque : les données sont chargées côté client via la server
   action searchMedia (pagination, recherche). La page transmet le rôle
   (suppression admin-only) ; l'en-tête, la barre d'outils et le bouton
   Téléverser (interactif) vivent dans MediaLibrary. */
export default async function AdminMediasPage() {
  const staff = await requireStaff();
  const isAdmin = await getIsAdmin(staff);

  return <MediaLibrary canDelete={isAdmin} />;
}
