import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";

/* Sous-layout admin-only : la facturation (abonnements, mandats SEPA,
   factures, incidents, synchro) est fermée aux éditeurs. Défense en
   profondeur JWT + miroir profiles.role via getIsAdmin. */
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  if (!(await getIsAdmin(staff))) {
    return (
      <AccessDenied
        email={staff.email}
        scope="facturation, abonnements, mandats SEPA"
      />
    );
  }

  return children;
}
