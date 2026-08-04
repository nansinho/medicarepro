import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ============================================================
   Tableau de données du back office.

   Ce composant existe pour une raison précise : l'en-tête et la
   cellule doivent porter le MÊME rôle de colonne. Réglé à la main dans
   treize tableaux, ça dérive au premier ajout de colonne — et ça avait
   dérivé, en 89 largeurs différentes.

   Composant serveur (aucun hook) : les pages continuent de streamer.
   ============================================================ */

export type ColRole =
  | "fit"
  | "num"
  | "date"
  | "money"
  | "mono"
  | "id"
  | "actions"
  | "grow"
  | "grow-2"
  | "grow-3";

export type Column<T> = {
  id: string;
  header: ReactNode;
  /** Rôle de largeur et d'alignement (cf. globals.css). */
  role?: ColRole;
  /** Tronque avec des points de suspension (impose max-width: 0). */
  truncate?: boolean;
  cell: (row: T) => ReactNode;
  /** Info-bulle native, utile sur une colonne tronquée. */
  title?: (row: T) => string | undefined;
  className?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  getKey,
  href,
  empty,
  footer,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** Rend chaque ligne cliquable, avec un chevron en dernière colonne. */
  href?: (row: T) => string;
  /** Rendu quand `rows` est vide : l'en-tête reste visible au-dessus. */
  empty: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const colCount = columns.length + (href ? 1 : 0);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  data-col={col.role ?? "fit"}
                  className={col.className}
                >
                  {col.header}
                </TableHead>
              ))}
              {href && (
                <TableHead data-col="actions">
                  <span className="sr-only">Ouvrir</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              /* L'en-tête reste affiché : on ne perd pas le vocabulaire
                 des colonnes parce qu'il n'y a pas encore de ligne. */
              <tr>
                <td colSpan={colCount} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getKey(row);
                const link = href?.(row);
                return (
                  <TableRow key={key} className={link ? "group" : undefined}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        data-col={col.role ?? "fit"}
                        data-truncate={col.truncate ? "" : undefined}
                        title={col.title?.(row)}
                        className={col.className}
                      >
                        {link ? (
                          <Link href={link} className="block outline-none">
                            {col.cell(row)}
                          </Link>
                        ) : (
                          col.cell(row)
                        )}
                      </TableCell>
                    ))}
                    {link && (
                      <TableCell data-col="actions">
                        <Link
                          href={link}
                          aria-label="Ouvrir la fiche"
                          className="inline-grid size-6 place-items-center rounded-md text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {footer && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border bg-secondary/50 px-4 py-2.5 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Cellule de tête d'un enregistrement : libellé fort + ligne secondaire. */
export function CellTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-foreground">{children}</span>
      {sub && (
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      )}
    </span>
  );
}

/** Actions de ligne : discrètes au repos, nettes au survol de la ligne. */
export function RowActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("mp-row-actions flex items-center justify-end gap-1", className)}
    >
      {children}
    </span>
  );
}
