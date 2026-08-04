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
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <div className="flex flex-col gap-4">
      {notice && (
        <Notice
          tone={notice.ok ? "ok" : "bad"}
          title={notice.ok ? "Action effectuée" : "Erreur"}
        >
          {notice.message ?? (notice.ok ? "OK" : "Une erreur est survenue.")}
        </Notice>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{cfg.title}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {rows.length}
            </span>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => setEditing({ id: null, values: emptyValues() })}
              >
                <Plus />
                Ajouter
              </Button>
            )}
          </div>
        </CardHeader>

        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucun élément pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {hasPosition && <TableHead className="w-24">Ordre</TableHead>}
                  <TableHead>Élément</TableHead>
                  {hasPublished && (
                    <TableHead className="w-32">Visibilité</TableHead>
                  )}
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    {hasPosition && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon-sm"
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
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
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
                            <ArrowDown />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <button
                        type="button"
                        className="text-left text-[13px] font-medium text-foreground transition-colors hover:text-primary"
                        onClick={() =>
                          setEditing({ id: row.id, values: row.values })
                        }
                      >
                        {row.summary}
                      </button>
                    </TableCell>
                    {hasPublished && (
                      <TableCell>
                        <button
                          type="button"
                          className="cursor-pointer disabled:cursor-default disabled:opacity-50"
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
                          <Badge variant={row.published ? "green" : "gray"}>
                            {row.published ? "Visible" : "Masqué"}
                          </Badge>
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditing({ id: row.id, values: row.values })
                          }
                        >
                          Modifier
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            aria-label="Supprimer"
                            onClick={() => {
                              if (
                                !window.confirm(`Supprimer « ${row.summary} » ?`)
                              )
                                return;
                              const formData = new FormData();
                              formData.set("collection", collection);
                              formData.set("id", row.id);
                              run(() => deleteCollectionRow(formData));
                            }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Panneau d'édition (latéral, pas de modal centré) */}
      <Sheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {editing.id ? "Modifier" : "Ajouter"} · {cfg.title}
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <FieldsRenderer
                  tree={tree}
                  value={editing.values}
                  onChange={(values) => setEditing({ ...editing, values })}
                />
              </div>

              <SheetFooter className="flex-row justify-end gap-2">
                <SheetClose asChild>
                  <Button variant="outline">Annuler</Button>
                </SheetClose>
                <Button disabled={pending} onClick={handleSave}>
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
