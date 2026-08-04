import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";
import { Notice } from "@/components/admin/shared";
import { billingConfigWarnings, missingCheckoutEnv } from "@/lib/env";

/* Sous-layout admin-only : la facturation (abonnements, mandats SEPA,
   factures, incidents, synchro) est fermée aux éditeurs. Défense en
   profondeur JWT + miroir profiles.role via getIsAdmin.

   Il porte aussi les alertes de CONFIGURATION d'encaissement : une caisse
   fermée ou un rythme de prélèvement douteux doivent se voir depuis
   n'importe quelle page de facturation, pas seulement dans les logs. */
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

  // Noms de variables uniquement — jamais de valeur.
  const missing = missingCheckoutEnv();
  const warnings = billingConfigWarnings();

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <Notice tone="bad" title="Encaissement fermé : configuration incomplète">
          Le tunnel d&apos;inscription et les paiements de renouvellement
          répondent « momentanément indisponible ». Variable(s) à renseigner :{" "}
          <code className="font-mono text-[12px]">{missing.join(", ")}</code>.
          Les notifications de paiement déjà en cours continuent d&apos;être
          traitées normalement.
        </Notice>
      )}
      {warnings.map((warning) => (
        <Notice key={warning} tone="warn" title="Rythme de prélèvement à confirmer">
          {warning}
        </Notice>
      ))}
      {children}
    </div>
  );
}
