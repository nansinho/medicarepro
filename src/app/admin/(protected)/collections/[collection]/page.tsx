import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, getIsAdmin } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import {
  COLLECTIONS_ADMIN,
  COLLECTION_KEYS,
  type CollectionKey,
} from "@/lib/admin/collections-admin";
import CollectionManager, {
  type CollectionRowData,
} from "@/components/admin/collections/CollectionManager";
import { PageHeading, Notice } from "@/components/admin/shared";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Collections" };

export default async function AdminCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  const cfg = COLLECTIONS_ADMIN[collection as CollectionKey];
  if (!cfg) notFound();

  const staff = await requireStaff();
  const isAdmin = await getIsAdmin(staff);
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Collections" />
        <Notice tone="warn" title="Supabase non configuré">
          La gestion des collections est indisponible sur cet environnement.
        </Notice>
      </div>
    );
  }

  const idColumn = cfg.idColumn ?? "id";
  let query = service.from(cfg.table).select("*");
  query = cfg.hasPosition
    ? query.order("position", { ascending: true })
    : query.order(idColumn, { ascending: true });
  const { data } = await query;

  const rows: CollectionRowData[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row[idColumn]),
      summary: String(row[cfg.summaryField] ?? "(sans titre)"),
      published: cfg.hasPublished ? Boolean(row.published) : null,
      values: cfg.toForm(row),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Collections" description={cfg.description} />

      <nav className="flex flex-wrap gap-1.5" aria-label="Collections">
        {COLLECTION_KEYS.map((key) => {
          const active = key === cfg.key;
          return (
            <Link
              key={key}
              href={`/admin/collections/${key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {COLLECTIONS_ADMIN[key].title}
            </Link>
          );
        })}
      </nav>

      <CollectionManager
        collection={cfg.key}
        rows={rows}
        canDelete={isAdmin && !cfg.fixedRows}
        canCreate={!cfg.fixedRows}
        hasPublished={cfg.hasPublished}
        hasPosition={cfg.hasPosition}
      />
    </div>
  );
}
