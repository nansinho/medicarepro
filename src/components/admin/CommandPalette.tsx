"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { navGroupsFor, type NavLink } from "./nav";
import { cn } from "@/lib/utils";

/* ============================================================
   Palette de navigation (⌘K / Ctrl+K).

   Elle remplace le champ de recherche décoratif de la barre
   supérieure, qui affichait un raccourci ⌘K sans aucun gestionnaire.
   Sur un écran jugé au niveau Linear, un contrôle mort coûte plus cher
   que son absence.

   Aucune donnée inventée : la palette ne liste que les entrées réelles
   de nav.ts, filtrées par le rôle. Une recherche de contenu (articles,
   médias, abonnés) serait un autre chantier, avec ses requêtes.
   ============================================================ */

type Entry = NavLink & { group: string };

export default function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "admin" | "editor";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(
    () =>
      navGroupsFor(role).flatMap((g) =>
        g.links.map((link) => ({ ...link, group: g.title })),
      ),
    [role],
  );

  const results = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.label} ${e.group} ${e.keywords ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q),
    );
  }, [entries, query]);

  /* Toute frappe repart du premier résultat : sinon le curseur pointe
     dans le vide dès que la liste rétrécit. */
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    onOpenChange(false);
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) =>
        results.length ? (c - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  }

  /* Le curseur doit rester visible quand on descend au clavier. */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Aller à une section</DialogTitle>
        <DialogDescription className="sr-only">
          Rechercher parmi les sections du back office.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Aller à une section…"
            aria-label="Aller à une section"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:block">
            Échap
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(420px,60dvh)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Aucune section ne correspond à « {query} ».
            </p>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon;
              const active = i === cursor;
              return (
                <button
                  key={entry.href}
                  type="button"
                  data-active={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-cell transition-colors",
                    active
                      ? "bg-[color:var(--mp-tone-primary-bg)] text-[color:var(--mp-blue-mid)]"
                      : "text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.group}
                  </span>
                  {active && (
                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
