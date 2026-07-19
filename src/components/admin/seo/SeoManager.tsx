"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteRedirect,
  dismissNotFound,
  saveRedirect,
  saveSeoMeta,
  toggleRedirect,
  type SeoActionResult,
} from "@/app/admin/(protected)/seo/actions";
import { Close } from "@/components/icons";
import s from "../Admin.module.css";
import m from "../media/media.module.css";
import c from "../collections/collections.module.css";
import x from "./seo.module.css";

/* ============================================================
   SEO : trois vues — métas par page, redirections, 404.
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

type View = "metas" | "redirections" | "404";

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
  const [view, setView] = useState<View>("metas");
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
    <div className={x.wrap}>
      <nav className={c.tabs} aria-label="Vues SEO">
        {(
          [
            ["metas", `Métas par page (${routes.length})`],
            ["redirections", `Redirections (${redirects.length})`],
            ["404", `Pages introuvables (${notFound.length})`],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${c.tab} ${view === key ? c.tabActive : ""}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {notice && (
        <p
          className={notice.ok ? c.noticeOk : c.noticeErr}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.message ?? (notice.ok ? "OK" : "Erreur")}
        </p>
      )}

      {view === "metas" && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Page</th>
                <th>Titre</th>
                <th>Sitemap</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.path}>
                  <td>
                    <span className={s.tdMain}>{route.path}</span>
                    {route.overridden && (
                      <span className={s.tdSub}>personnalisé</span>
                    )}
                  </td>
                  <td>
                    <span className={s.tdSub}>{route.title}</span>
                  </td>
                  <td>
                    {route.noindex ? (
                      <span className={`${s.badge} ${s.tRed}`}>noindex</span>
                    ) : route.sitemapInclude ? (
                      <span className={`${s.badge} ${s.tGreen}`}>
                        {route.sitemapPriority.toFixed(1)}
                      </span>
                    ) : (
                      <span className={`${s.badge} ${s.tGray}`}>exclu</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={s.btnSmall}
                      onClick={() => setEditingMeta(route)}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "redirections" && (
        <>
          {isAdmin && (
            <button
              type="button"
              className={s.primaryBtn}
              onClick={() =>
                setRedirectDraft({ from_path: "", to_path: "", status_code: 301 })
              }
            >
              + Nouvelle redirection
            </button>
          )}
          <p className={x.hint}>
            Note : Next sert les 301 en 308 et les 302 en 307 — équivalent
            pour le référencement.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Depuis</th>
                  <th>Vers</th>
                  <th>Code</th>
                  <th>Utilisée</th>
                  {isAdmin && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {redirects.map((row) => (
                  <tr key={row.id} className={row.is_active ? undefined : x.inactive}>
                    <td>
                      <span className={s.tdMain}>{row.from_path}</span>
                    </td>
                    <td>
                      <span className={s.tdSub}>{row.to_path}</span>
                    </td>
                    <td>
                      <span className={`${s.badge} ${s.tBlue}`}>{row.status_code}</span>
                    </td>
                    <td>
                      <span className={s.tdSub}>{row.hits}×</span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className={s.rowActions}>
                          <button
                            type="button"
                            className={s.btnSmall}
                            disabled={pending}
                            onClick={() => {
                              const formData = new FormData();
                              formData.set("id", row.id);
                              formData.set("is_active", String(!row.is_active));
                              run(() => toggleRedirect(formData));
                            }}
                          >
                            {row.is_active ? "Désactiver" : "Activer"}
                          </button>
                          <button
                            type="button"
                            className={s.btnSmallDanger}
                            disabled={pending}
                            onClick={() => {
                              if (!window.confirm(`Supprimer la redirection ${row.from_path} ?`))
                                return;
                              const formData = new FormData();
                              formData.set("id", row.id);
                              run(() => deleteRedirect(formData));
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {redirects.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4}>
                      <span className={s.tdSub}>Aucune redirection.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "404" && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Chemin demandé</th>
                <th>Vues</th>
                <th>Dernier referer</th>
                {isAdmin && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {notFound.map((row) => (
                <tr key={row.path}>
                  <td>
                    <span className={s.tdMain}>{row.path}</span>
                  </td>
                  <td>
                    <span className={s.tdSub}>{row.hit_count}×</span>
                  </td>
                  <td>
                    <span className={s.tdSub}>{row.last_referer ?? "—"}</span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className={s.rowActions}>
                        <button
                          type="button"
                          className={s.btnSmall}
                          onClick={() =>
                            setRedirectDraft({
                              from_path: row.path,
                              to_path: "",
                              status_code: 301,
                            })
                          }
                        >
                          Créer une redirection
                        </button>
                        <button
                          type="button"
                          className={s.btnSmallDanger}
                          disabled={pending}
                          onClick={() => {
                            const formData = new FormData();
                            formData.set("path", row.path);
                            run(() => dismissNotFound(formData));
                          }}
                        >
                          Ignorer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {notFound.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3}>
                    <span className={s.tdSub}>
                      Aucun 404 enregistré — bon signe.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Panneau : édition des métas */}
      {editingMeta && (
        <div className={m.overlay} role="dialog" aria-modal="true">
          <div className={m.panel}>
            <button
              type="button"
              className={m.panelClose}
              onClick={() => setEditingMeta(null)}
              aria-label="Fermer"
            >
              <Close width={16} height={16} />
            </button>
            <h2 className={c.editTitle}>Métas — {editingMeta.path}</h2>
            <form
              className={x.form}
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
              <label>
                Titre
                <input name="title" defaultValue={editingMeta.title} maxLength={70} />
              </label>
              <label className={x.check}>
                <input
                  type="checkbox"
                  name="title_absolute"
                  defaultChecked={editingMeta.titleAbsolute}
                />
                Titre absolu (sans « | MediCare Pro »)
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  maxLength={170}
                  defaultValue={editingMeta.description}
                />
              </label>
              <label>
                URL canonique
                <input name="canonical" defaultValue={editingMeta.canonical} />
              </label>
              <label className={x.check}>
                <input type="checkbox" name="noindex" defaultChecked={editingMeta.noindex} />
                Ne pas indexer (noindex)
              </label>
              <label className={x.check}>
                <input
                  type="checkbox"
                  name="sitemap_include"
                  defaultChecked={editingMeta.sitemapInclude}
                />
                Inclure dans le sitemap
              </label>
              <div className={x.row2}>
                <label>
                  Priorité (0-1)
                  <input
                    name="sitemap_priority"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    defaultValue={editingMeta.sitemapPriority}
                  />
                </label>
                <label>
                  Fréquence
                  <select
                    name="sitemap_changefreq"
                    defaultValue={editingMeta.sitemapChangefreq}
                  >
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuelle</option>
                    <option value="yearly">Annuelle</option>
                  </select>
                </label>
              </div>
              <button type="submit" className={s.primaryBtn} disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Panneau : redirection */}
      {redirectDraft && (
        <div className={m.overlay} role="dialog" aria-modal="true">
          <div className={m.panel}>
            <button
              type="button"
              className={m.panelClose}
              onClick={() => setRedirectDraft(null)}
              aria-label="Fermer"
            >
              <Close width={16} height={16} />
            </button>
            <h2 className={c.editTitle}>Redirection</h2>
            <form
              className={x.form}
              action={(formData) => run(() => saveRedirect(formData), true)}
            >
              <label>
                Depuis (chemin)
                <input
                  name="from_path"
                  required
                  defaultValue={redirectDraft.from_path}
                  placeholder="/ancienne-page"
                />
              </label>
              <label>
                Vers
                <input
                  name="to_path"
                  required
                  defaultValue={redirectDraft.to_path}
                  placeholder="/nouvelle-page ou https://…"
                />
              </label>
              <label>
                Type
                <select name="status_code" defaultValue={redirectDraft.status_code}>
                  <option value={301}>301 — définitive (SEO transféré)</option>
                  <option value={302}>302 — temporaire</option>
                </select>
              </label>
              <button type="submit" className={s.primaryBtn} disabled={pending}>
                {pending ? "Enregistrement…" : "Créer la redirection"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
