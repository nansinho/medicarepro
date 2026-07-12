"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bulkPostAction,
  changePostStatus,
  duplicatePost,
} from "@/app/admin/(protected)/blog/actions";
import DataTable, {
  type Column,
  type Filter,
} from "@/components/admin/ui/DataTable";
import RowMenu, { type RowMenuItem } from "@/components/admin/ui/RowMenu";
import { useToast } from "@/components/admin/ui/Toast";
import s from "../Admin.module.css";

/* ============================================================
   Liste des articles : DataTable (recherche, filtre statut, tri,
   sélection multiple + actions groupées) + menu d'options par
   ligne (dupliquer, publier/dépublier, aperçu, voir sur le site).
   Écran témoin du niveau « CMS pro ».
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

const STATUS_META: Record<string, { label: string; tone: string; rank: number }> = {
  draft: { label: "Brouillon", tone: "tGray", rank: 0 },
  needs_review: { label: "En relecture", tone: "tAmber", rank: 1 },
  approved: { label: "Approuvé", tone: "tBlue", rank: 2 },
  scheduled: { label: "Programmé", tone: "tBlue", rank: 3 },
  published: { label: "Publié", tone: "tGreen", rank: 4 },
  archived: { label: "Archivé", tone: "tGray", rank: 5 },
};

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function BlogList({ rows }: { rows: BlogListRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
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

  function rowMenu(row: BlogListRow): RowMenuItem[] {
    const items: RowMenuItem[] = [
      { label: "Modifier", href: `/admin/blog/${row.id}` },
      { label: "Aperçu", href: `/admin/blog/${row.id}/apercu`, newTab: true },
    ];
    if (row.status === "published") {
      items.push({
        label: "Voir sur le site",
        href: `/blog/${row.slug}`,
        newTab: true,
      });
      items.push({
        label: "Dépublier",
        onClick: () => changeStatus(row.id, "draft"),
      });
    } else {
      items.push({
        label: "Publier",
        onClick: () => changeStatus(row.id, "published"),
      });
    }
    items.push({
      label: "Dupliquer",
      onClick: () => duplicate(row.id),
    });
    if (row.status !== "archived") {
      items.push({
        label: "Archiver",
        onClick: () => changeStatus(row.id, "archived"),
      });
    }
    return items;
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

  const columns: Column<BlogListRow>[] = [
    {
      key: "title",
      header: "Article",
      sortValue: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <>
          <Link href={`/admin/blog/${r.id}`} className={s.tdMain}>
            {r.title}
          </Link>
          <span className={s.tdSub}>
            /blog/{r.slug}
            {r.origin === "ai" ? " · IA" : ""}
            {r.readingTime ? ` · ${r.readingTime} min` : ""}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: "Statut",
      width: "140px",
      sortValue: (r) => STATUS_META[r.status]?.rank ?? 0,
      cell: (r) => {
        const meta = STATUS_META[r.status] ?? STATUS_META.draft;
        return (
          <span className={`${s.badge} ${s[meta.tone as keyof typeof s]}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "date",
      header: "Publication",
      width: "180px",
      sortValue: (r) =>
        r.scheduledFor ?? r.publishedAt ?? "",
      cell: (r) => (
        <span className={s.tdSub}>
          {r.status === "scheduled" && r.scheduledFor
            ? `le ${DATE_FMT.format(new Date(r.scheduledFor))}`
            : r.publishedAt
              ? DATE_FMT.format(new Date(r.publishedAt))
              : "—"}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Modifié",
      width: "160px",
      sortValue: (r) => r.updatedAt ?? "",
      cell: (r) => (
        <span className={s.tdSub}>
          {r.updatedAt ? DATE_FMT.format(new Date(r.updatedAt)) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "1%",
      align: "right",
      cell: (r) => <RowMenu items={rowMenu(r)} disabled={pending && busyId === r.id} />,
    },
  ];

  const filters: Filter<BlogListRow>[] = [
    {
      key: "status",
      label: "Statut",
      options: Object.entries(STATUS_META).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
      test: (row, value) => row.status === value,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${r.title} ${r.slug}`}
      searchPlaceholder="Rechercher un article…"
      filters={filters}
      bulkActions={[
        { key: "publish", label: "Publier" },
        { key: "draft", label: "Dépublier" },
        { key: "archive", label: "Archiver" },
        {
          key: "delete",
          label: "Supprimer",
          variant: "danger",
          confirm: "Supprimer définitivement les articles sélectionnés ?",
        },
      ]}
      onBulkAction={handleBulk}
      emptyLabel="Aucun article — créez le premier."
    />
  );
}
