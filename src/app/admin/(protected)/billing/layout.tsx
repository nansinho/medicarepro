import { ChevronDown, TriangleAlert } from "lucide-react";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import AccessDenied from "@/components/admin/AccessDenied";
import { Notice } from "@/components/admin/shared";
import { PageStack } from "@/components/admin/kit/layout";
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
    /* PageStack et non `space-y-6` : un seul rythme vertical dans tout le
       back office, sinon l'écart du layout et celui des pages s'additionnent
       (c'est ce qui donnait 24px ici et 16 ou 20px juste en dessous). */
    <PageStack>
      {missing.length > 0 && (
        <Notice tone="bad" title="Encaissement fermé : configuration incomplète">
          Le tunnel d&apos;inscription et les paiements de renouvellement
          répondent « momentanément indisponible ». Variable(s) à renseigner :{" "}
          <code className="font-mono text-xs">{missing.join(", ")}</code>. Les
          notifications de paiement déjà en cours continuent d&apos;être traitées
          normalement.
        </Notice>
      )}

      {/* Avertissement de configuration : bandeau d'UNE ligne, dépliable.
          En Notice pleine hauteur il se répétait sur les sept écrans de
          facturation et poussait le contenu vers le bas à chaque fois. */}
      {warnings.map((warning) => (
        <details
          key={warning}
          className="group rounded-xl border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/8 px-3 py-2 text-xs"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground">
            <TriangleAlert className="size-3.5 shrink-0 text-[color:var(--warn)]" />
            Rythme de prélèvement à confirmer
            <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 max-w-[76ch] leading-relaxed text-muted-foreground">
            {warning}
          </p>
        </details>
      ))}

      {children}
    </PageStack>
  );
}
