import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";

/* Gestion des comptes : admin uniquement. */
export default async function UtilisateursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  if (!(await getIsAdmin(staff))) {
    return <AccessDenied email={staff.email} scope="gestion des utilisateurs" />;
  }

  return children;
}
