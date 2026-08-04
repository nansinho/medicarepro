"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  searchMedia,
  type MediaRow,
} from "@/app/admin/(protected)/medias/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ============================================================
   Sélecteur d'image réutilisable (blog : couverture ; éditeur de
   pages : champs ImageRef). Contrat aligné sur ImageRefSchema :
   { mediaId: uuid | null, path, alt } — path = URL publique du
   média (bucket media) ou chemin /images/* (bucket legacy).
   Panneau latéral pleine hauteur (pas de modal centré).
   ============================================================ */

export type ImageRefValue = {
  mediaId: string | null;
  path: string;
  alt: string;
};

export default function ImagePicker({
  value,
  onChange,
  label = "Image",
}: {
  value: ImageRefValue;
  onChange: (next: ImageRefValue) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-2.5">
        <span className="flex h-14 w-[72px] flex-none items-center justify-center overflow-hidden rounded-md bg-secondary">
          {value.path ? (
            /* eslint-disable-next-line @next/next/no-img-element -- vignette admin */
            <img src={value.path} alt={value.alt} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-muted-foreground">vide</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Input
            type="text"
            value={value.alt}
            placeholder="Texte alternatif (alt)"
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            className="h-8"
          />
          <small className="truncate text-[11px] text-muted-foreground">
            {value.path || "Aucune image sélectionnée"}
          </small>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Choisir…
        </Button>
      </div>

      {open && (
        <PickerPanel
          onClose={() => setOpen(false)}
          onPick={(row) => {
            onChange({
              mediaId: row.id,
              path: row.url ?? row.path,
              alt: value.alt || row.alt,
            });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Panneau de sélection seul (utilisé aussi par l'éditeur riche). */
export function PickerPanel({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (row: MediaRow) => void;
}) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* Le panneau est rendu dans <body>, pas à sa place dans l'arbre : la colonne
     de contenu porte `container-type: inline-size`, ce qui en fait un bloc
     conteneur pour les descendants `fixed`. Rendu en ligne, l'overlay serait
     borné à la colonne au lieu du viewport. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Échap ferme, et le fond ne défile pas tant que le panneau est ouvert. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchMedia({ q: q || undefined, page })
        .then((res) => {
          setRows(res.rows);
          setTotal(res.total);
        })
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [q, page]);

  const pages = Math.max(1, Math.ceil(total / 40));

  if (!mounted) return null;

  /* Cible du portail : la racine `.admin-scope`, et non <body>. Elle est en
     dehors de la colonne de contenu (donc pas de piège de bloc conteneur) tout
     en portant les tokens du back office, qui seraient perdus sous <body>. */
  const host =
    document.querySelector<HTMLElement>(".admin-scope") ?? document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-foreground/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-border bg-background p-4 shadow-lg duration-300 animate-in slide-in-from-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X />
        </Button>
        <h2 className="pr-10 text-base font-semibold text-foreground">Choisir une image</h2>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-[13px] text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onPick(row)}
                title={row.path}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-colors hover:border-primary/60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette admin */}
                <img
                  src={row.url ?? row.path}
                  alt={row.alt}
                  loading="lazy"
                  className="aspect-square w-full bg-secondary object-cover"
                />
                <span className="flex flex-col gap-0.5 px-2.5 py-2">
                  <b className="truncate text-xs font-semibold text-foreground">
                    {row.path.split("/").pop()}
                  </b>
                  <small className="truncate text-[11px] text-muted-foreground">
                    {row.alt || "alt manquant"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft />
            </Button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {page + 1} / {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>,
    host,
  );
}
