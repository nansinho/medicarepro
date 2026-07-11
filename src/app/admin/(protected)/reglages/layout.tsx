import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";

/* Réglages du site : admin uniquement (écritures site_settings
   réservées au rôle admin par la RLS). */
export default async function ReglagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  if (!(await getIsAdmin(staff))) {
    return <AccessDenied email={staff.email} scope="réglages du site" />;
  }

  return children;
}
