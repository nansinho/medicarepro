"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Barre de filtres, portée du design system de l'app praticien.
   Tous les contrôles à 36px, jamais collante, un emplacement `end`
   pour l'action de réinitialisation.
   ============================================================ */

export function FilterBar({
  end,
  className,
  children,
}: {
  end?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="search"
      aria-label="Filtres"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {children}
      {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}

/**
 * Champ de recherche débouncé. 300ms : assez pour ne pas requêter à
 * chaque frappe, assez court pour que la liste suive la saisie.
 * Échap efface, comme partout ailleurs.
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  /* La valeur pilotée reprend la main si elle change de l'extérieur
     (réinitialisation des filtres). Ajusté pendant le rendu, pas dans un
     effet : la remise à zéro doit être visible dès la même frame. */
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  /* 300ms : assez pour ne pas requêter à chaque frappe, assez court pour
     que la liste suive la saisie. */
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onChange(draft), 300);
    return () => window.clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className={cn("relative min-w-[220px] max-w-[320px] flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft("");
            onChange("");
          }
        }}
        className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-cell shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => {
            setDraft("");
            onChange("");
          }}
          className="mp-icon-btn absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Pastille de filtre booléenne (aria-pressed, pas un bouton muet). */
export function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-[color:var(--mp-tone-primary-bg)] text-[color:var(--mp-blue-mid)]"
          : "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground",
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className="tabular-nums opacity-70">{count}</span>
      )}
    </button>
  );
}
