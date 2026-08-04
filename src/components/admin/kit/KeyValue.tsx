import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Liste clé / valeur des écrans de détail.

   L'ancien rendu mettait la clé à gauche et la valeur alignée à droite.
   Dans une carte de 836px, cela creusait 700px de vide entre « Plan » et
   sa valeur : le même défaut que la page étirée, tourné de 90°.

   Ici, deux colonnes fixes alignées sur la ligne de base : la valeur
   commence toujours au même endroit, et la rangée passe de ~40px à
   ~32px de haut, ce qui fait tenir un enregistrement entier sans
   défilement.
   ============================================================ */

export type KeyValueItem = {
  k: ReactNode;
  v: ReactNode;
  /** Valeur technique (référence, RUM, identifiant). */
  mono?: boolean;
};

export function KeyValue({
  items,
  className,
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col", className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,132px)_minmax(0,1fr)] items-baseline gap-x-4 border-t border-border px-5 py-2 first:border-t-0"
        >
          <dt className="text-xs text-muted-foreground">{item.k}</dt>
          <dd
            className={cn(
              "min-w-0 text-cell text-foreground [overflow-wrap:anywhere]",
              item.mono && "font-mono text-xs tabular-nums",
            )}
          >
            {item.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
