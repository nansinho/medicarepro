import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ToastProvider from "@/components/admin/ui/Toast";
import s from "@/components/admin/Admin.module.css";

/* ============================================================
   Layout du back office protégé. Structure des routes :
   - /admin/login          → HORS de ce groupe (page publique)
   - /admin/(protected)/*  → tout le reste, gardé ici.
   Le proxy (src/proxy.ts) fait le pré-filtre optimiste ;
   requireStaff est LA vérification autoritaire (JWT app_metadata).
   Le groupe est ouvert au STAFF (admin + éditeur) : les sections
   réservées (billing, réglages, utilisateurs, audit) posent leur
   propre sous-layout admin-only (getIsAdmin + AccessDenied).
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
    <ToastProvider>
      <div className={s.shell}>
        <AdminSidebar
          displayName={staff.displayName}
          email={staff.email}
          role={staff.role}
        />
        <main className={s.main}>{children}</main>
      </div>
    </ToastProvider>
  );
}
