"use client";

import { useEffect, useState } from "react";
import {
  searchMedia,
  type MediaRow,
} from "@/app/admin/(protected)/medias/actions";
import { Close, Search } from "@/components/icons";
import m from "./media.module.css";
import p from "./picker.module.css";

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
    <div className={p.field}>
      <span className={p.label}>{label}</span>
      <div className={p.row}>
        <span className={p.thumb}>
          {value.path ? (
            /* eslint-disable-next-line @next/next/no-img-element -- vignette admin */
            <img src={value.path} alt={value.alt} />
          ) : (
            <span className={p.thumbEmpty}>vide</span>
          )}
        </span>
        <div className={p.meta}>
          <input
            type="text"
            value={value.alt}
            placeholder="Texte alternatif (alt)"
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
          />
          <small>{value.path || "Aucune image sélectionnée"}</small>
        </div>
        <button type="button" className={p.chooseBtn} onClick={() => setOpen(true)}>
          Choisir…
        </button>
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

function PickerPanel({
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

  return (
    <div className={m.overlay} role="dialog" aria-modal="true">
      <div className={`${m.panel} ${p.pickerPanel}`}>
        <button
          type="button"
          className={m.panelClose}
          onClick={onClose}
          aria-label="Fermer"
        >
          <Close width={16} height={16} />
        </button>
        <h2 className={p.pickerTitle}>Choisir une image</h2>

        <label className={m.search}>
          <Search width={15} height={15} />
          <input
            type="search"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>

        {loading ? (
          <p className={m.empty}>Chargement…</p>
        ) : (
          <div className={`${m.grid} ${p.pickerGrid}`}>
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className={m.card}
                onClick={() => onPick(row)}
                title={row.path}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette admin */}
                <img src={row.url ?? row.path} alt={row.alt} loading="lazy" />
                <span className={m.cardMeta}>
                  <b>{row.path.split("/").pop()}</b>
                  <small>{row.alt || "alt manquant"}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className={m.pager}>
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
