"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  deleteMedia,
  searchMedia,
  updateMediaMeta,
  uploadMedia,
  type MediaRow,
} from "@/app/admin/(protected)/medias/actions";
import { Close, Image as ImageIcon, Plus, Search } from "@/components/icons";
import s from "../Admin.module.css";
import m from "./media.module.css";

/* ============================================================
   Médiathèque (client). Données via la server action searchMedia ;
   mutations via uploadMedia / updateMediaMeta / deleteMedia puis
   rechargement de la liste. Sert aussi de base à l'ImagePicker
   (même grille, mode sélection).
   ============================================================ */

export default function MediaLibrary({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(
    (nextPage = page) => {
      setLoading(true);
      searchMedia({ q, folder: folder || undefined, page: nextPage })
        .then((res) => {
          setRows(res.rows);
          setTotal(res.total);
          setFolders(res.folders);
        })
        .catch((err: Error) => setNotice(err.message))
        .finally(() => setLoading(false));
    },
    [q, folder, page],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => reload(page), q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [reload, page, q]);

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    formData.set("folder", folder);
    startTransition(async () => {
      try {
        const result = await uploadMedia(formData);
        setNotice(
          result.errors.length
            ? `${result.uploaded} envoyé(s) · ${result.errors.join(" — ")}`
            : `${result.uploaded} image(s) envoyée(s).`,
        );
        setPage(0);
        reload(0);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Envoi impossible.");
      } finally {
        if (fileInput.current) fileInput.current.value = "";
      }
    });
  }

  function handleMetaSave(formData: FormData) {
    startTransition(async () => {
      try {
        await updateMediaMeta(formData);
        setSelected(null);
        reload();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Mise à jour impossible.");
      }
    });
  }

  function handleDelete(row: MediaRow) {
    if (!window.confirm(`Supprimer définitivement « ${row.path} » ?`)) return;
    const formData = new FormData();
    formData.set("id", row.id);
    startTransition(async () => {
      try {
        await deleteMedia(formData);
        setSelected(null);
        reload();
        setNotice("Image supprimée.");
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Suppression impossible.");
      }
    });
  }

  const pages = Math.max(1, Math.ceil(total / 40));

  return (
    <div>
      <div className={m.toolbar}>
        <label className={m.search}>
          <Search width={15} height={15} />
          <input
            type="search"
            placeholder="Rechercher (nom, alt, titre)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>

        <select
          className={m.folderSelect}
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setPage(0);
          }}
          aria-label="Filtrer par dossier"
        >
          <option value="">Tous les dossiers</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={m.uploadBtn}
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          <Plus width={15} height={15} />
          {pending ? "Envoi…" : "Téléverser"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {notice && (
        <p className={s.banner} role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <p className={m.empty}>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className={m.empty}>
          <ImageIcon width={22} height={22} /> Aucune image
          {q || folder ? " pour ce filtre" : " — téléversez la première"}.
        </p>
      ) : (
        <div className={m.grid}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={m.card}
              onClick={() => setSelected(row)}
              title={row.path}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- vignettes admin : pas d'optimisation nécessaire */}
              <img src={row.url ?? row.path} alt={row.alt} loading="lazy" />
              <span className={m.cardMeta}>
                <b>{row.path.split("/").pop()}</b>
                <small>
                  {row.width && row.height ? `${row.width}×${row.height}` : row.bucket}
                  {row.alt ? "" : " · alt manquant"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className={m.pager}>
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ← Précédent
          </button>
          <span>
            Page {page + 1} / {pages} · {total} images
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Suivant →
          </button>
        </div>
      )}

      {selected && (
        <div className={m.overlay} role="dialog" aria-modal="true">
          <div className={m.panel}>
            <button
              type="button"
              className={m.panelClose}
              onClick={() => setSelected(null)}
              aria-label="Fermer"
            >
              <Close width={16} height={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu admin */}
            <img className={m.panelImg} src={selected.url ?? selected.path} alt={selected.alt} />
            <form action={handleMetaSave} className={m.panelForm}>
              <input type="hidden" name="id" value={selected.id} />
              <label>
                Texte alternatif (alt)
                <input name="alt" defaultValue={selected.alt} maxLength={300} />
              </label>
              <label>
                Titre (interne)
                <input name="title" defaultValue={selected.title ?? ""} maxLength={200} />
              </label>
              <p className={m.panelPath}>
                {selected.path}
                {selected.folder ? ` · dossier : ${selected.folder}` : ""}
              </p>
              <div className={m.panelActions}>
                <button type="submit" className={m.saveBtn} disabled={pending}>
                  Enregistrer
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className={m.deleteBtn}
                    disabled={pending}
                    onClick={() => handleDelete(selected)}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
