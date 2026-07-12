"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishCities,
  queueGeneration,
  setReviewStatus,
  triggerWorker,
  unpublishCity,
  type VilleActionResult,
} from "@/app/admin/(protected)/villes/actions";
import s from "../Admin.module.css";
import c from "../collections/collections.module.css";
import vs from "./villes.module.css";

/* ============================================================
   Gestion des villes SEO : générer par vague, déclencher le
   worker, revoir (avec claims à vérifier), publier par vague.
   ============================================================ */

export type CityRow = {
  id: string;
  slug: string;
  name: string;
  region: string;
  wave: number;
  status: string;
  reviewNotes: string | null;
  claims: string[];
};

const WAVES = [1, 2, 3];

export default function VillesManager({
  rows,
  waves,
  aiReady,
}: {
  rows: CityRow[];
  waves: Record<number, { total: number; published: number }>;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<VilleActionResult | null>(null);
  const [reviewing, setReviewing] = useState<CityRow | null>(null);

  function run(action: () => Promise<VilleActionResult>, close = false) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) {
        if (close) setReviewing(null);
        router.refresh();
      }
    });
  }

  return (
    <div className={vs.wrap}>
      {/* Actions par vague */}
      <section className={vs.waves}>
        <h2>Génération &amp; publication par vague</h2>
        <div className={vs.waveGrid}>
          {WAVES.map((wave) => {
            const w = waves[wave] ?? { total: 0, published: 0 };
            return (
              <div key={wave} className={vs.waveCard}>
                <b>Vague {wave}</b>
                <small>
                  {w.published}/{w.total} publiées
                </small>
                <div className={vs.waveActions}>
                  <button
                    type="button"
                    disabled={pending || !aiReady}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("wave", String(wave));
                      run(() => queueGeneration(fd));
                    }}
                  >
                    Générer
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("wave", String(wave));
                      run(() => publishCities(fd));
                    }}
                  >
                    Publier les approuvées
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className={vs.workerBtn}
          disabled={pending || !aiReady}
          onClick={() => run(() => triggerWorker())}
        >
          ▶ Lancer la génération maintenant
        </button>
        <p className={vs.hint}>
          La génération tourne en arrière-plan (worker). Sinon, le cron la
          traite toutes les 5 minutes.
        </p>
      </section>

      {notice && (
        <p
          className={notice.ok ? c.noticeOk : c.noticeErr}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.message ?? (notice.ok ? "OK" : "Erreur")}
        </p>
      )}

      {/* File de revue */}
      <section>
        <h2 className={vs.sectionTitle}>À revoir ({rows.length})</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Ville</th>
                <th>Vague</th>
                <th>Statut</th>
                <th>À vérifier</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={s.tdMain}>{row.name}</span>
                    <span className={s.tdSub}>{row.region}</span>
                  </td>
                  <td>
                    <span className={s.tdSub}>{row.wave}</span>
                  </td>
                  <td>
                    <span
                      className={`${s.badge} ${
                        row.status === "approved"
                          ? s.tGreen
                          : row.status === "needs_review"
                            ? s.tAmber
                            : s.tBlue
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {row.claims.length > 0 ? (
                      <span className={`${s.badge} ${s.tAmber}`}>
                        {row.claims.length} fait(s)
                      </span>
                    ) : (
                      <span className={s.tdSub}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button
                        type="button"
                        className={s.btnSmall}
                        onClick={() => setReviewing(row)}
                      >
                        Revoir
                      </button>
                      <a
                        className={s.btnSmall}
                        href={`/logiciel-podologue/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Aperçu
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <span className={s.tdSub}>
                      Aucune ville en attente de revue.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panneau de revue */}
      {reviewing && (
        <div className={vs.overlay} role="dialog" aria-modal="true">
          <div className={vs.panel}>
            <button
              type="button"
              className={vs.close}
              onClick={() => setReviewing(null)}
            >
              ✕
            </button>
            <h2>{reviewing.name}</h2>
            <p className={vs.reviewSub}>
              {reviewing.region} · vague {reviewing.wave} · {reviewing.status}
            </p>

            {reviewing.claims.length > 0 && (
              <div className={vs.claims}>
                <h3>⚠️ Faits à vérifier avant d&apos;approuver</h3>
                <ul>
                  {reviewing.claims.map((claim, i) => (
                    <li key={i}>{claim}</li>
                  ))}
                </ul>
              </div>
            )}

            <a
              className={vs.previewLink}
              href={`/logiciel-podologue/${reviewing.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir la page rendue ↗
            </a>

            <div className={vs.reviewActions}>
              <button
                type="button"
                className={vs.approve}
                disabled={pending}
                onClick={() => {
                  if (
                    reviewing.claims.length > 0 &&
                    !window.confirm(
                      "Avez-vous vérifié tous les faits locaux listés ? L'approbation vaut validation.",
                    )
                  ) {
                    return;
                  }
                  const fd = new FormData();
                  fd.set("cityId", reviewing.id);
                  fd.set("status", "approved");
                  run(() => setReviewStatus(fd), true);
                }}
              >
                Approuver
              </button>
              <button
                type="button"
                className={vs.reject}
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("cityId", reviewing.id);
                  fd.set("status", "needs_review");
                  run(() => setReviewStatus(fd), true);
                }}
              >
                À retravailler
              </button>
              {reviewing.status === "approved" && (
                <button
                  type="button"
                  className={s.btnSmall}
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("cityId", reviewing.id);
                    run(() => publishCities(fd), true);
                  }}
                >
                  Publier cette ville
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* unpublishCity est exposé pour l'admin depuis la page publiée (non câblé ici
   pour rester simple ; disponible pour un futur écran « publiées »). */
void unpublishCity;
