import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Card } from "@/components/ui/card";
import { ADMIN_THEME_BOOT } from "@/components/admin/AdminThemeProvider";

/* ============================================================
   Coque des écrans d'accès au back office (connexion, mot de passe
   oublié, confirmation d'invitation).

   Elle portait le même bloc recopié dans trois fichiers : scope,
   centrage, logo, pastille « Back office », titre, sous-titre, filet
   de pied. Une seule définition désormais, script de thème compris —
   sinon l'écran de connexion flashe en clair avant de basculer.

   Pas de "use client" : utilisable depuis un composant serveur comme
   depuis un composant client (ConfirmForm).
   ============================================================ */

export default function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div id="admin-scope" className="admin-scope" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOT }} />
      <main className="relative z-[1] flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6 shadow-lg">
          <div className="mb-5 flex items-center justify-between">
            <BrandLogo size={34} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" />
              Back office
            </span>
          </div>

          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}

          {children && <div className="mt-5">{children}</div>}

          {footer && (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
              {footer}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
