import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { hasAi } from "@/lib/ai/anthropic";
import VillesManager, {
  type CityRow,
} from "@/components/admin/villes/VillesManager";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Villes SEO" };

const STATUS_ORDER = [
  "seeded",
  "generated",
  "needs_review",
  "approved",
  "published",
  "archived",
] as const;

export default async function AdminVillesPage() {
  const service = serviceClient();
  const aiReady = hasAi();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Villes SEO</h1>
        </header>
        <p className={s.banner}>Supabase non configuré.</p>
      </>
    );
  }

  /* Comptages par statut et par vague (vue d'ensemble). */
  const { data: all } = await service
    .from("cities")
    .select("status, wave");
  const byStatus: Record<string, number> = {};
  const byWave: Record<number, { total: number; published: number }> = {};
  for (const row of all ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    const w = (byWave[row.wave] ??= { total: 0, published: 0 });
    w.total += 1;
    if (row.status === "published") w.published += 1;
  }

  /* Villes à traiter en priorité : générées / en revue / approuvées. */
  const { data: actionable } = await service
    .from("cities")
    .select("id, slug, name, region, wave, status, review_notes, content")
    .in("status", ["generated", "needs_review", "approved"])
    .order("wave")
    .order("name")
    .limit(200);

  const rows: CityRow[] = (actionable ?? []).map((c) => {
    const content = c.content as { claims_to_verify?: string[] } | null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      region: c.region,
      wave: c.wave,
      status: c.status,
      reviewNotes: c.review_notes,
      claims: Array.isArray(content?.claims_to_verify)
        ? content!.claims_to_verify
        : [],
    };
  });

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Villes SEO local</h1>
          <p className={s.pageDesc}>Pages locales par ville — génération IA et publication par vague.</p>
        </div>
      </header>

      {!aiReady && (
        <p className={s.banner}>
          ⚠️ IA non configurée : ajoutez ANTHROPIC_API_KEY et ANTHROPIC_MODEL
          dans l&apos;environnement pour activer la génération.
        </p>
      )}

      <div className={s.kpiGrid}>
        {STATUS_ORDER.map((status) => (
          <div key={status} className={s.kpiCard}>
            <span className={s.kpiLabel}>{status}</span>
            <span className={s.kpiValue}>{byStatus[status] ?? 0}</span>
          </div>
        ))}
      </div>

      <VillesManager
        rows={rows}
        waves={byWave}
        aiReady={aiReady}
      />
    </>
  );
}
