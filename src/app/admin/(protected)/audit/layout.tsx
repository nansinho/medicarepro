import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";

/* Journal d'audit : admin uniquement (SELECT staff en RLS, mais on
   réserve la consultation aux admins côté UI). */
export default async function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  if (!(await getIsAdmin(staff))) {
    return <AccessDenied email={staff.email} scope="journal d'audit" />;
  }
  return children;
}
