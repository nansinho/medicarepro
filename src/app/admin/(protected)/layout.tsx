import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";
import {
  ADMIN_THEME_BOOT,
  AdminThemeProvider,
} from "@/components/admin/AdminThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./admin-theme.css";

/* ============================================================
   Layout du back office protégé. Structure des routes :
   - /admin/login          → HORS de ce groupe (page publique)
   - /admin/(protected)/*  → tout le reste, gardé ici.
   Le proxy (src/proxy.ts) fait le pré-filtre optimiste ;
   requireStaff est LA vérification autoritaire (JWT app_metadata).

   Le div racine porte `admin-scope` : tokens shadcn/ui scopés
   (admin-theme.css), polices Figtree/Poppins héritées du layout racine,
   et la classe `dark` du sélecteur de thème. Tout le back office hérite
   de là ; la vitrine, hors de ce scope, n'est pas touchée.
   ============================================================ */

export const metadata: Metadata = {
  title: {
    default: "Back office",
    template: "%s | Back office MediCare Pro",
  },
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Redirige vers /admin/login si non connecté ou non staff. */
  const staff = await requireStaff();

  return (
    /* suppressHydrationWarning : la classe `dark` est posée par le script
       ci-dessous AVANT la première peinture, donc avant l'hydratation. Sans
       lui, React signalerait une divergence ; sans le script, on verrait un
       flash clair à chaque rechargement en mode sombre. */
    <div id="admin-scope" className="admin-scope" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOT }} />
      <AdminThemeProvider>
        <AdminShell
          displayName={staff.displayName}
          email={staff.email}
          role={staff.role}
        >
          {children}
        </AdminShell>
        <Toaster />
      </AdminThemeProvider>
    </div>
  );
}
