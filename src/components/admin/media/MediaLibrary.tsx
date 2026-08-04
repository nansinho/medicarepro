"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteMedia,
  searchMedia,
  updateMediaMeta,
  uploadMedia,
  type MediaRow,
} from "@/app/admin/(protected)/medias/actions";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
            ? `${result.uploaded} envoyé(s) · ${result.errors.join(" · ")}`
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

  function copyUrl(row: MediaRow) {
    const url = row.url ?? row.path;
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(row.id);
      window.setTimeout(
        () => setCopiedId((current) => (current === row.id ? null : current)),
        1500,
      );
    });
  }

  const pages = Math.max(1, Math.ceil(total / 40));
  const noticeTone: "ok" | "bad" =
    notice && /impossible|introuvable|illisible|accept|dépasse|erreur|échou|storage/i.test(notice)
      ? "bad"
      : "ok";

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Médias"
        description="Bibliothèque d'images du site."
        actions={
          <Button size="sm" disabled={pending} onClick={() => fileInput.current?.click()}>
            <Upload />
            {pending ? "Envoi…" : "Téléverser"}
          </Button>
        }
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        hidden
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Barre d'outils : recherche + filtre par dossier */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher (nom, alt, titre)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setPage(0);
          }}
          aria-label="Filtrer par dossier"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Tous les dossiers</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <Notice tone={noticeTone}>
          <span role="status">{notice}</span>
        </Notice>
      )}

      {/* Zone de téléversement (glisser-déposer ou parcourir) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-center"
      >
        <span className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
          <Upload className="size-5" />
        </span>
        <p className="text-[13px] text-muted-foreground">
          Glissez vos images ici ou téléversez-les depuis votre ordinateur.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload />
          {pending ? "Envoi…" : "Parcourir les fichiers"}
        </Button>
        <p className="text-[11px] text-muted-foreground/80">
          JPG, PNG, WebP, AVIF ou GIF, 10 Mo maximum par image.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-[13px] text-muted-foreground shadow-sm">
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-14 text-center shadow-sm">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
            <ImageIcon className="size-6" />
          </span>
          <p className="text-[13px] font-medium text-foreground">
            {q || folder ? "Aucune image pour ce filtre" : "Aucune image pour le moment"}
          </p>
          <p className="text-xs text-muted-foreground">
            {q || folder
              ? "Modifiez votre recherche ou le dossier sélectionné."
              : "Téléversez votre première image avec le bouton ci-dessus."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 @wide/page:grid-cols-7 @ultra/page:grid-cols-8">
          {rows.map((row) => (
            <div
              key={row.id}
              className="mp-lift group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:border-[color:var(--mp-blue-soft)]"
            >
              <button
                type="button"
                onClick={() => setSelected(row)}
                title={row.path}
                className="block w-full text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- vignettes admin : pas d'optimisation nécessaire */}
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
                    {row.width && row.height ? `${row.width}×${row.height}` : row.bucket}
                    {row.alt ? "" : " · alt manquant"}
                  </small>
                </span>
              </button>
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="shadow-sm"
                  aria-label="Copier l'URL"
                  onClick={() => copyUrl(row)}
                >
                  {copiedId === row.id ? <Check className="text-ok" /> : <Copy />}
                </Button>
                {canDelete && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="text-bad shadow-sm hover:text-bad"
                    aria-label="Supprimer l'image"
                    disabled={pending}
                    onClick={() => handleDelete(row)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
            Précédent
          </Button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Page {page + 1} / {pages} · {total} images
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Suivant
            <ChevronRight />
          </Button>
        </div>
      )}

      {/* Panneau latéral de détail (pas de modal centré) */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {selected && (
            <form action={handleMetaSave} className="flex h-full flex-col">
              <input type="hidden" name="id" value={selected.id} />
              <SheetHeader>
                <SheetTitle>Détail de l&apos;image</SheetTitle>
                <SheetDescription className="break-all">
                  {selected.path.split("/").pop()}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu admin */}
                <img
                  src={selected.url ?? selected.path}
                  alt={selected.alt}
                  className="max-h-72 w-full rounded-lg border border-border bg-secondary object-contain"
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="media-alt">Texte alternatif (alt)</Label>
                  <Input id="media-alt" name="alt" defaultValue={selected.alt} maxLength={300} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="media-title">Titre (interne)</Label>
                  <Input
                    id="media-title"
                    name="title"
                    defaultValue={selected.title ?? ""}
                    maxLength={200}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5">
                  <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">
                    {selected.path}
                    {selected.folder ? ` · dossier : ${selected.folder}` : ""}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="flex-none"
                    aria-label="Copier l'URL"
                    onClick={() => copyUrl(selected)}
                  >
                    {copiedId === selected.id ? <Check className="text-ok" /> : <Copy />}
                  </Button>
                </div>
              </div>

              <SheetFooter className="flex-row gap-2">
                <Button type="submit" className="flex-1" disabled={pending}>
                  Enregistrer
                </Button>
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-bad hover:text-bad"
                    disabled={pending}
                    onClick={() => handleDelete(selected)}
                  >
                    <Trash2 />
                    Supprimer
                  </Button>
                )}
                <SheetClose asChild>
                  <Button type="button" variant="ghost">
                    Fermer
                  </Button>
                </SheetClose>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
