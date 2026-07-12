"use client";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Search, Caret, ChevronUp } from "@/components/icons";
import d from "./dataTable.module.css";

/* ============================================================
   Tableau de gestion générique du back office : recherche,
   filtres, tri par colonne, pagination, sélection multiple +
   barre d'actions groupées. Rendu 100 % côté client (les listes
   admin sont petites — centaines de lignes max) ; les données
   arrivent en props depuis un Server Component.
   ============================================================ */

export type Column<Row> = {
  key: string;
  header: string;
  /** Rendu de la cellule. */
  cell: (row: Row) => ReactNode;
  /** Valeur de tri (string ou number). Absent = colonne non triable. */
  sortValue?: (row: Row) => string | number;
  /** Largeur fixe optionnelle (ex. "1%" pour une colonne d'actions). */
  width?: string;
  align?: "left" | "right" | "center";
};

export type Filter<Row> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Vrai si la ligne passe le filtre pour la valeur choisie. */
  test: (row: Row, value: string) => boolean;
};

export type BulkAction = {
  key: string;
  label: string;
  variant?: "default" | "danger";
  confirm?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

export default function DataTable<Row>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Rechercher…",
  filters = [],
  bulkActions = [],
  onBulkAction,
  pageSize = 15,
  emptyLabel = "Aucun élément.",
}: {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** Texte concaténé sur lequel porte la recherche plein-texte. */
  searchText: (row: Row) => string;
  searchPlaceholder?: string;
  filters?: Filter<Row>[];
  bulkActions?: BulkAction[];
  onBulkAction?: (actionKey: string, ids: string[]) => void;
  pageSize?: number;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Filtrage + recherche */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !searchText(row).toLowerCase().includes(q)) return false;
      for (const filter of filters) {
        const value = filterValues[filter.key];
        if (value && value !== "__all" && !filter.test(row, value)) return false;
      }
      return true;
    });
  }, [rows, query, filterValues, filters, searchText]);

  /* Tri */
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [filtered, sort, columns]);

  /* Pagination */
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(
    clampedPage * pageSize,
    clampedPage * pageSize + pageSize,
  );

  const pageIds = pageRows.map(rowKey);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function runBulk(action: BulkAction) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action.confirm && !window.confirm(action.confirm)) return;
    onBulkAction?.(action.key, ids);
    setSelected(new Set());
  }

  const hasFilters = filters.length > 0;
  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v && v !== "__all",
  ).length;

  return (
    <div className={d.wrap}>
      {/* Toolbar : recherche + filtres */}
      <div className={d.toolbar}>
        <label className={d.search}>
          <Search width={15} height={15} />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>

        {hasFilters &&
          filters.map((filter) => (
            <select
              key={filter.key}
              className={d.filter}
              value={filterValues[filter.key] ?? "__all"}
              onChange={(e) => {
                setFilterValues((prev) => ({
                  ...prev,
                  [filter.key]: e.target.value,
                }));
                setPage(0);
              }}
              aria-label={filter.label}
            >
              <option value="__all">{filter.label} : tous</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}

        <span className={d.count}>
          {sorted.length}
          {sorted.length !== rows.length ? ` / ${rows.length}` : ""}
          {activeFilterCount > 0 ? " (filtré)" : ""}
        </span>
      </div>

      {/* Barre d'actions groupées (quand sélection) */}
      {selected.size > 0 && bulkActions.length > 0 && (
        <div className={d.bulkBar} role="region" aria-label="Actions groupées">
          <span>
            <b>{selected.size}</b> sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div className={d.bulkActions}>
            {bulkActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={
                  action.variant === "danger" ? d.bulkDanger : d.bulkBtn
                }
                onClick={() => runBulk(action)}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              className={d.bulkClear}
              onClick={() => setSelected(new Set())}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className={d.tableWrap}>
        <table className={d.table}>
          <thead>
            <tr>
              {bulkActions.length > 0 && (
                <th className={d.checkCell}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align }}
                  className={col.sortValue ? d.sortable : undefined}
                  onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
                  aria-sort={
                    sort?.key === col.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span className={d.thInner}>
                    {col.header}
                    {col.sortValue &&
                      (sort?.key === col.key ? (
                        <ChevronUp
                          width={13}
                          height={13}
                          className={sort.dir === "desc" ? d.sortDesc : d.sortAsc}
                        />
                      ) : (
                        <Caret width={12} height={12} className={d.sortIdle} />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = rowKey(row);
              const isSel = selected.has(id);
              return (
                <tr key={id} className={isSel ? d.rowSelected : undefined}>
                  {bulkActions.length > 0 && (
                    <td className={d.checkCell}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(id)}
                        aria-label="Sélectionner la ligne"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align }}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                  className={d.empty}
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className={d.pager}>
          <button
            type="button"
            disabled={clampedPage === 0}
            onClick={() => setPage(clampedPage - 1)}
          >
            ← Précédent
          </button>
          <span>
            Page {clampedPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage(clampedPage + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
