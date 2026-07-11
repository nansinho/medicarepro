"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCollectionRow,
  moveCollectionRow,
  saveCollectionRow,
  togglePublished,
  type CollectionActionResult,
} from "@/app/admin/(protected)/collections/actions";
import {
  COLLECTIONS_ADMIN,
  type CollectionKey,
} from "@/lib/admin/collections-admin";
import { buildTreeFromSchema, defaultValue } from "@/lib/admin/forms/introspect";
import { FieldsRenderer } from "@/components/admin/forms/SectionForm";
import { Close, Plus } from "@/components/icons";
import s from "../Admin.module.css";
import m from "../media/media.module.css";
import c from "./collections.module.css";

/* ============================================================
   Gestionnaire générique d'une collection : liste ordonnée +
   panneau latéral d'édition (formulaire généré du schéma zod).
   ============================================================ */

export type CollectionRowData = {
  id: string;
  summary: string;
  published: boolean | null;
  values: Record<string, unknown>;
};

export default function CollectionManager({
  collection,
  rows,
  canDelete,
  canCreate,
  hasPublished,
  hasPosition,
}: {
  collection: CollectionKey;
  rows: CollectionRowData[];
  canDelete: boolean;
  canCreate: boolean;
  hasPublished: boolean;
  hasPosition: boolean;
}) {
  const router = useRouter();
  const cfg = COLLECTIONS_ADMIN[collection];
  const tree = useMemo(() => buildTreeFromSchema(cfg.schema), [cfg]);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<CollectionActionResult | null>(null);
  const [editing, setEditing] = useState<
    | { id: string | null; values: Record<string, unknown> }
    | null
  >(null);

  function run(action: () => Promise<CollectionActionResult>, close = false) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) {
        if (close) setEditing(null);
        router.refresh();
      }
    });
  }

  function emptyValues(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const node of tree) {
      const key = node.path.split(".").pop() ?? node.path;
      out[key] = defaultValue(node);
    }
    return out;
  }

  function handleSave() {
    if (!editing) return;
    const formData = new FormData();
    formData.set("collection", collection);
    if (editing.id) formData.set("id", editing.id);
    formData.set("values", JSON.stringify(editing.values));
    run(() => saveCollectionRow(formData), true);
  }

  return (
    <div className={c.wrap}>
      {canCreate && (
        <button
          type="button"
          className={s.primaryBtn}
          onClick={() => setEditing({ id: null, values: emptyValues() })}
        >
          <Plus width={15} height={15} /> Ajouter
        </button>
      )}

      {notice && (
        <p
          className={notice.ok ? c.noticeOk : c.noticeErr}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.message ?? (notice.ok ? "OK" : "Erreur")}
        </p>
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              {hasPosition && <th aria-label="Ordre" />}
              <th>Élément</th>
              {hasPublished && <th>Visibilité</th>}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                {hasPosition && (
                  <td className={c.orderCell}>
                    <button
                      type="button"
                      disabled={pending || index === 0}
                      aria-label="Monter"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("collection", collection);
                        formData.set("id", row.id);
                        formData.set("direction", "up");
                        run(() => moveCollectionRow(formData));
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={pending || index === rows.length - 1}
                      aria-label="Descendre"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("collection", collection);
                        formData.set("id", row.id);
                        formData.set("direction", "down");
                        run(() => moveCollectionRow(formData));
                      }}
                    >
                      ↓
                    </button>
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    className={c.rowTitle}
                    onClick={() => setEditing({ id: row.id, values: row.values })}
                  >
                    {row.summary}
                  </button>
                </td>
                {hasPublished && (
                  <td>
                    <button
                      type="button"
                      className={`${s.badge} ${row.published ? s.tGreen : s.tGray} ${c.pubToggle}`}
                      disabled={pending}
                      title="Cliquer pour basculer"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("collection", collection);
                        formData.set("id", row.id);
                        formData.set("published", String(!row.published));
                        run(() => togglePublished(formData));
                      }}
                    >
                      {row.published ? "Visible" : "Masqué"}
                    </button>
                  </td>
                )}
                <td>
                  <div className={s.rowActions}>
                    <button
                      type="button"
                      className={s.btnSmall}
                      onClick={() => setEditing({ id: row.id, values: row.values })}
                    >
                      Modifier
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className={s.btnSmallDanger}
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Supprimer « ${row.summary} » ?`)) return;
                          const formData = new FormData();
                          formData.set("collection", collection);
                          formData.set("id", row.id);
                          run(() => deleteCollectionRow(formData));
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className={m.overlay} role="dialog" aria-modal="true">
          <div className={`${m.panel} ${c.editPanel}`}>
            <button
              type="button"
              className={m.panelClose}
              onClick={() => setEditing(null)}
              aria-label="Fermer"
            >
              <Close width={16} height={16} />
            </button>
            <h2 className={c.editTitle}>
              {editing.id ? "Modifier" : "Ajouter"} — {cfg.title}
            </h2>
            <FieldsRenderer
              tree={tree}
              value={editing.values}
              onChange={(values) => setEditing({ ...editing, values })}
            />
            <div className={c.editFoot}>
              <button
                type="button"
                className={s.primaryBtn}
                disabled={pending}
                onClick={handleSave}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
