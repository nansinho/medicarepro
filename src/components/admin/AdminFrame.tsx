import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Le cadre : LE SEUL endroit où la largeur de contenu est écrite.

   Il est utilisé deux fois — par la barre supérieure et par <main> —
   et c'est tout l'intérêt : le fil d'Ariane et le titre de page
   partagent la même colonne. Avant, seul <main> était plafonné et
   l'en-tête courait sur toute la largeur : sur un écran de 2600px,
   le fil d'Ariane démarrait 382px à gauche du <h1>.

   La valeur elle-même vit dans admin-theme.css (--admin-max, 1760px),
   avec le reste des mesures de la coque.
   ============================================================ */

export default function AdminFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[var(--admin-max)] px-4 md:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
