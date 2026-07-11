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
import s from "@/components/admin/Admin.module.css";
import c from "@/components/admin/collections/collections.module.css";

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
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Collections</h1>
        </header>
        <p className={s.banner}>Supabase non configuré.</p>
      </>
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
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Collections</h1>
          <p className={s.pageDesc}>{cfg.description}</p>
        </div>
      </header>

      <nav className={c.tabs} aria-label="Collections">
        {COLLECTION_KEYS.map((key) => (
          <Link
            key={key}
            href={`/admin/collections/${key}`}
            className={`${c.tab} ${key === cfg.key ? c.tabActive : ""}`}
          >
            {COLLECTIONS_ADMIN[key].title}
          </Link>
        ))}
      </nav>

      <CollectionManager
        collection={cfg.key}
        rows={rows}
        canDelete={isAdmin && !cfg.fixedRows}
        canCreate={!cfg.fixedRows}
        hasPublished={cfg.hasPublished}
        hasPosition={cfg.hasPosition}
      />
    </>
  );
}
