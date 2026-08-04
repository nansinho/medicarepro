import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { requireStaff } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";
import ToastProvider from "@/components/admin/ui/Toast";
import "./admin-theme.css";

/* ============================================================
   Layout du back office protégé. Structure des routes :
   - /admin/login          → HORS de ce groupe (page publique)
   - /admin/(protected)/*  → tout le reste, gardé ici.
   Le proxy (src/proxy.ts) fait le pré-filtre optimiste ;
   requireStaff est LA vérification autoritaire (JWT app_metadata).

   Le div racine porte `admin-scope` (tokens shadcn/ui, scopés dans
   admin-theme.css) et la variable de police Geist. Tout le back office
   hérite de là ; la vitrine, hors de ce scope, n'est pas touchée.
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
    <div className={`admin-scope ${GeistSans.variable}`}>
      <ToastProvider>
        <AdminShell
          displayName={staff.displayName}
          email={staff.email}
          role={staff.role}
        >
          {children}
        </AdminShell>
      </ToastProvider>
    </div>
  );
}
