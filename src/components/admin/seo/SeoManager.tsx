"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  deleteRedirect,
  dismissNotFound,
  saveRedirect,
  saveSeoMeta,
  toggleRedirect,
  type SeoActionResult,
} from "@/app/admin/(protected)/seo/actions";
import { Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

/* ============================================================
   SEO : trois vues (métas par page, redirections, 404).
   Les redirections et la purge des 404 sont admin-only (les
   boutons sont masqués pour les éditeurs ; la garde serveur
   reste la référence).
   ============================================================ */

export type SeoMetaRow = {
  path: string;
  title: string;
  titleAbsolute: boolean;
  description: string;
  canonical: string;
  noindex: boolean;
  sitemapInclude: boolean;
  sitemapPriority: number;
  sitemapChangefreq: string;
  overridden: boolean;
};

export type RedirectRow = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  is_active: boolean;
  hits: number;
  last_hit_at: string | null;
};

export type NotFoundRow = {
  path: string;
  hit_count: number;
  last_referer: string | null;
  last_seen: string;
};

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export default function SeoManager({
  routes,
  redirects,
  notFound,
  isAdmin,
}: {
  routes: SeoMetaRow[];
  redirects: RedirectRow[];
  notFound: NotFoundRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<SeoActionResult | null>(null);
  const [editingMeta, setEditingMeta] = useState<SeoMetaRow | null>(null);
  const [redirectDraft, setRedirectDraft] = useState<{
    from_path: string;
    to_path: string;
    status_code: number;
  } | null>(null);

  function run(action: () => Promise<SeoActionResult>, close = false) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) {
        if (close) {
          setEditingMeta(null);
          setRedirectDraft(null);
        }
        router.refresh();
      }
    });
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

      <Tabs defaultValue="metas" className="gap-4">
        <TabsList>
          <TabsTrigger value="metas">
            Métas par page
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              ({routes.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="redirections">
            Redirections
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              ({redirects.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="404">
            Pages introuvables
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              ({notFound.length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* --- Métas par page --- */}
        <TabsContent value="metas">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Page</TableHead>
                    <TableHead className="min-w-[260px]">Titre</TableHead>
                    <TableHead className="w-28">Sitemap</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((route) => (
                    <TableRow key={route.path}>
                      <TableCell>
                        <div className="font-mono text-xs tabular-nums text-muted-foreground">
                          {route.path}
                        </div>
                        {route.overridden && (
                          <Badge variant="blue" className="mt-1.5">
                            personnalisé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-[360px] truncate text-muted-foreground"
                        title={route.title}
                      >
                        {route.title}
                      </TableCell>
                      <TableCell>
                        {route.noindex ? (
                          <Badge variant="red">noindex</Badge>
                        ) : route.sitemapInclude ? (
                          <Badge variant="green" className="font-mono tabular-nums">
                            {route.sitemapPriority.toFixed(1)}
                          </Badge>
                        ) : (
                          <Badge variant="gray">exclu</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMeta(route)}
                        >
                          Modifier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* --- Redirections --- */}
        <TabsContent value="redirections" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Note : Next sert les 301 en 308 et les 302 en 307 (équivalent pour
              le référencement).
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="flex-none"
                onClick={() =>
                  setRedirectDraft({ from_path: "", to_path: "", status_code: 301 })
                }
              >
                <Plus />
                Nouvelle redirection
              </Button>
            )}
          </div>
          <Card className="overflow-hidden">
            {redirects.length === 0 ? (
              <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                Aucune redirection.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Depuis</TableHead>
                      <TableHead className="min-w-[200px]">Vers</TableHead>
                      <TableHead className="w-20">Code</TableHead>
                      <TableHead className="w-24 text-right">Utilisée</TableHead>
                      {isAdmin && (
                        <TableHead className="w-[200px] text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redirects.map((row) => (
                      <TableRow
                        key={row.id}
                        className={row.is_active ? undefined : "opacity-50"}
                      >
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {row.from_path}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {row.to_path}
                        </TableCell>
                        <TableCell>
                          <Badge variant="blue" className="font-mono tabular-nums">
                            {row.status_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {row.hits}×
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => {
                                  const formData = new FormData();
                                  formData.set("id", row.id);
                                  formData.set("is_active", String(!row.is_active));
                                  run(() => toggleRedirect(formData));
                                }}
                              >
                                {row.is_active ? "Désactiver" : "Activer"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Supprimer la redirection ${row.from_path} ?`,
                                    )
                                  )
                                    return;
                                  const formData = new FormData();
                                  formData.set("id", row.id);
                                  run(() => deleteRedirect(formData));
                                }}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* --- Pages introuvables (404) --- */}
        <TabsContent value="404">
          <Card className="overflow-hidden">
            {notFound.length === 0 ? (
              <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                Aucun 404 enregistré, bon signe.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Chemin demandé</TableHead>
                      <TableHead className="w-20 text-right">Vues</TableHead>
                      <TableHead className="min-w-[200px]">Dernier referer</TableHead>
                      {isAdmin && (
                        <TableHead className="w-[260px] text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notFound.map((row) => (
                      <TableRow key={row.path}>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {row.path}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {row.hit_count}×
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {row.last_referer ?? "—"}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setRedirectDraft({
                                    from_path: row.path,
                                    to_path: "",
                                    status_code: 301,
                                  })
                                }
                              >
                                Créer une redirection
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                className="text-muted-foreground"
                                onClick={() => {
                                  const formData = new FormData();
                                  formData.set("path", row.path);
                                  run(() => dismissNotFound(formData));
                                }}
                              >
                                Ignorer
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Panneau : édition des métas */}
      <Sheet
        open={!!editingMeta}
        onOpenChange={(open) => !open && setEditingMeta(null)}
      >
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          {editingMeta && (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  Métas
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {editingMeta.path}
                  </span>
                </SheetTitle>
              </SheetHeader>
              <form
                className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                action={(formData) => {
                  formData.set("path", editingMeta.path);
                  formData.set(
                    "title_absolute",
                    String(formData.get("title_absolute") === "on"),
                  );
                  formData.set("noindex", String(formData.get("noindex") === "on"));
                  formData.set(
                    "sitemap_include",
                    String(formData.get("sitemap_include") === "on"),
                  );
                  run(() => saveSeoMeta(formData), true);
                }}
              >
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  Titre
                  <Input name="title" defaultValue={editingMeta.title} maxLength={70} />
                </label>
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    name="title_absolute"
                    defaultChecked={editingMeta.titleAbsolute}
                    className="size-4 accent-[color:var(--primary)]"
                  />
                  Titre absolu (sans « | MediCare Pro »)
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  Description
                  <Textarea
                    name="description"
                    rows={3}
                    maxLength={170}
                    defaultValue={editingMeta.description}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  URL canonique
                  <Input name="canonical" defaultValue={editingMeta.canonical} />
                </label>
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    name="noindex"
                    defaultChecked={editingMeta.noindex}
                    className="size-4 accent-[color:var(--primary)]"
                  />
                  Ne pas indexer (noindex)
                </label>
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    name="sitemap_include"
                    defaultChecked={editingMeta.sitemapInclude}
                    className="size-4 accent-[color:var(--primary)]"
                  />
                  Inclure dans le sitemap
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                    Priorité (0-1)
                    <Input
                      name="sitemap_priority"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      defaultValue={editingMeta.sitemapPriority}
                      className="font-mono tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                    Fréquence
                    <select
                      name="sitemap_changefreq"
                      defaultValue={editingMeta.sitemapChangefreq}
                      className={SELECT_CLASS}
                    >
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuelle</option>
                      <option value="yearly">Annuelle</option>
                    </select>
                  </label>
                </div>
                <Button type="submit" disabled={pending} className="mt-1">
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Panneau : redirection */}
      <Sheet
        open={!!redirectDraft}
        onOpenChange={(open) => !open && setRedirectDraft(null)}
      >
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          {redirectDraft && (
            <>
              <SheetHeader>
                <SheetTitle>Redirection</SheetTitle>
              </SheetHeader>
              <form
                className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
                action={(formData) => run(() => saveRedirect(formData), true)}
              >
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  Depuis (chemin)
                  <Input
                    name="from_path"
                    required
                    defaultValue={redirectDraft.from_path}
                    placeholder="/ancienne-page"
                    className="font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  Vers
                  <Input
                    name="to_path"
                    required
                    defaultValue={redirectDraft.to_path}
                    placeholder="/nouvelle-page ou https://…"
                    className="font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                  Type
                  <select
                    name="status_code"
                    defaultValue={redirectDraft.status_code}
                    className={SELECT_CLASS}
                  >
                    <option value={301}>301 (définitive, SEO transféré)</option>
                    <option value={302}>302 (temporaire)</option>
                  </select>
                </label>
                <Button type="submit" disabled={pending} className="mt-1">
                  {pending ? "Enregistrement…" : "Créer la redirection"}
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
