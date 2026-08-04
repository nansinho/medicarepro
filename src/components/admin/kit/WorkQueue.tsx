import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   File de travail : ce qu'il reste à faire, en une seule liste.

   Elle remplace le bandeau vert « Facturation saine », qui occupait
   toute la largeur pour ne rien dire. Un tableau de bord doit ouvrir
   sur des actions, pas sur un satisfecit.

   Contrainte tenue : rien n'est inventé. Chaque élément vient d'une
   ligne réelle (incident, tâche de synchro, abonnement en défaut), et
   pointe vers l'écran où on le règle. Quand il n'y a rien, la liste est
   vide et le dit sobrement.
   ============================================================ */

export type QueueItem = {
  id: string;
  /** urgent = argent bloqué, attention = à traiter, info = à surveiller. */
  severity: "urgent" | "attention" | "info";
  title: string;
  detail?: ReactNode;
  href: string;
  meta?: ReactNode;
};

const DOT: Record<QueueItem["severity"], string> = {
  urgent: "bg-[color:var(--bad)]",
  attention: "bg-[color:var(--warn)]",
  info: "bg-[color:var(--mp-blue-mid)]",
};

const ORDER: Record<QueueItem["severity"], number> = {
  urgent: 0,
  attention: 1,
  info: 2,
};

export function WorkQueue({ items }: { items: QueueItem[] }) {
  const sorted = [...items].sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  );

  return (
    <div className="divide-y divide-border">
      {sorted.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="mp-row group flex items-center gap-3 px-5 py-2.5"
        >
          <span
            aria-hidden="true"
            className={cn("size-1.5 flex-none rounded-full", DOT[item.severity])}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-cell font-medium text-foreground">
              {item.title}
            </span>
            {item.detail && (
              <span className="block truncate text-xs text-muted-foreground">
                {item.detail}
              </span>
            )}
          </span>
          {item.meta && (
            <span className="flex-none text-xs text-muted-foreground">
              {item.meta}
            </span>
          )}
          <ChevronRight className="size-4 flex-none text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      ))}
    </div>
  );
}
