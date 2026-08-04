"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, ExternalLink, Eye, FileText, Search } from "lucide-react";
import {
  bulkPostAction,
  changePostStatus,
  duplicatePost,
} from "@/app/admin/(protected)/blog/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/admin/ui/Toast";

/* ============================================================
   Liste des articles : recherche, filtre par statut, sélection
   multiple + actions groupées, et actions par ligne (aperçu,
   voir sur le site, dupliquer, archiver, publier/dépublier).
   Écran témoin du niveau « CMS pro », habillé au design system.
   ============================================================ */

export type BlogListRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  origin: string;
  readingTime: number | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; variant: "green" | "amber" | "blue" | "gray" }
> = {
  draft: { label: "Brouillon", variant: "gray" },
  needs_review: { label: "En relecture", variant: "amber" },
  approved: { label: "Approuvé", variant: "blue" },
  scheduled: { label: "Programmé", variant: "amber" },
  published: { label: "Publié", variant: "green" },
  archived: { label: "Archivé", variant: "gray" },
};

const STATUS_ORDER = [
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function BlogList({ rows }: { rows: BlogListRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function refresh() {
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (q && !`${row.title} ${row.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter]);

  const publishedCount = rows.filter((r) => r.status === "published").length;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
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

  function handleBulk(actionKey: string, ids: string[]) {
    startTransition(async () => {
      const result = await bulkPostAction(
        actionKey as "publish" | "archive" | "draft" | "delete",
        ids,
      );
      if (result.ok) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function runBulk(
    action: "publish" | "draft" | "archive" | "delete",
    confirmMessage?: string,
  ) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    handleBulk(action, ids);
    setSelected(new Set());
  }

  function changeStatus(id: string, status: string) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    startTransition(async () => {
      const result = await changePostStatus(fd);
      setBusyId(null);
      if (result.ok) {
        toast.success(result.message ?? "Statut mis à jour.");
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function duplicate(id: string) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await duplicatePost(fd);
      setBusyId(null);
      if (result.ok) {
        toast.success(result.message ?? "Dupliqué.");
        router.push(`/admin/blog/${result.id}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un article…"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={statusFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              Tous
            </Button>
            {STATUS_ORDER.map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setStatusFilter((prev) => (prev === st ? null : st))
                }
              >
                {STATUS_META[st].label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-[13px]">
          <span className="font-medium text-foreground">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => runBulk("publish")}
            >
              Publier
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => runBulk("draft")}
            >
              Dépublier
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => runBulk("archive")}
            >
              Archiver
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                runBulk(
                  "delete",
                  "Supprimer définitivement les articles sélectionnés ?",
                )
              }
            >
              Supprimer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-[13px] text-muted-foreground">
            <FileText className="size-6 text-muted-foreground/40" />
            {rows.length === 0
              ? "Aucun article pour le moment. Créez le premier."
              : "Aucun article ne correspond à votre recherche."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="min-w-[260px]">Article</TableHead>
                <TableHead className="w-32">Statut</TableHead>
                <TableHead className="w-28">Origine</TableHead>
                <TableHead className="w-24 text-right">Lecture</TableHead>
                <TableHead className="w-44 text-right">Publication</TableHead>
                <TableHead className="w-44 text-right">Modifié</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.draft;
                const isSel = selected.has(r.id);
                const rowBusy = pending && busyId === r.id;
                return (
                  <TableRow
                    key={r.id}
                    data-state={isSel ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label="Sélectionner l'article"
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/blog/${r.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {r.title}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">
                        /blog/{r.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.origin === "ai" ? (
                        <Badge variant="blue">IA</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Manuel
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.readingTime ? `${r.readingTime} min` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.status === "scheduled" && r.scheduledFor
                        ? `le ${DATE_FMT.format(new Date(r.scheduledFor))}`
                        : r.publishedAt
                          ? DATE_FMT.format(new Date(r.publishedAt))
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {r.updatedAt ? DATE_FMT.format(new Date(r.updatedAt)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                          aria-label="Aperçu de l'article"
                          title="Aperçu"
                        >
                          <Link
                            href={`/admin/blog/${r.id}/apercu`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye />
                          </Link>
                        </Button>
                        {r.status === "published" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            asChild
                            aria-label="Voir sur le site"
                            title="Voir sur le site"
                          >
                            <a
                              href={`/blog/${r.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={rowBusy}
                          onClick={() => duplicate(r.id)}
                          aria-label="Dupliquer"
                          title="Dupliquer"
                        >
                          <Copy />
                        </Button>
                        {r.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={rowBusy}
                            onClick={() => changeStatus(r.id, "archived")}
                            aria-label="Archiver"
                            title="Archiver"
                          >
                            <Archive />
                          </Button>
                        )}
                        {r.status === "published" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rowBusy}
                            onClick={() => changeStatus(r.id, "draft")}
                          >
                            Dépublier
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rowBusy}
                            onClick={() => changeStatus(r.id, "published")}
                          >
                            Publier
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {filtered.length} article{filtered.length > 1 ? "s" : ""}
              {filtered.length !== rows.length ? ` sur ${rows.length}` : ""}
            </span>
            <span>{publishedCount} en ligne</span>
          </div>
        )}
      </Card>
    </div>
  );
}
