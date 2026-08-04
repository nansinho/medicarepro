import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { hasAi } from "@/lib/ai/anthropic";
import VillesManager, {
  type CityRow,
} from "@/components/admin/villes/VillesManager";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Villes SEO" };

const PIPELINE: { key: string; label: string; sub: string }[] = [
  { key: "seeded", label: "SEEDED", sub: "Préparées" },
  { key: "generated", label: "GENERATED", sub: "Rédigées" },
  { key: "needs_review", label: "NEEDS_REVIEW", sub: "À relire" },
  { key: "approved", label: "APPROVED", sub: "Prêtes" },
  { key: "published", label: "PUBLISHED", sub: "En ligne" },
  { key: "archived", label: "ARCHIVED", sub: "Retirées" },
];

const nf = new Intl.NumberFormat("fr-FR");

export default async function AdminVillesPage() {
  const service = serviceClient();
  const aiReady = hasAi();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Villes SEO local" />
        <Notice tone="warn" title="Supabase non configuré">
          La gestion des villes SEO est indisponible.
        </Notice>
      </div>
    );
  }

  const { data: all } = await service.from("cities").select("status, wave");
  const byStatus: Record<string, number> = {};
  const byWave: Record<number, { total: number; published: number }> = {};
  for (const row of all ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    const w = (byWave[row.wave] ??= { total: 0, published: 0 });
    w.total += 1;
    if (row.status === "published") w.published += 1;
  }

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
      claims: Array.isArray(content?.claims_to_verify) ? content!.claims_to_verify : [],
    };
  });

  const total = (all ?? []).length;
  const published = byStatus["published"] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Villes SEO local"
        description="Pages locales par ville, génération IA et publication par vague."
        actions={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {nf.format(published)} / {nf.format(total)} en ligne
          </span>
        }
      />

      {!aiReady && (
        <Notice
          tone="warn"
          title="IA non configurée"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/reglages">Réglages</Link>
            </Button>
          }
        >
          Ajoutez <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> et{" "}
          <span className="font-mono text-xs">ANTHROPIC_MODEL</span> dans l&apos;environnement pour activer la génération.
        </Notice>
      )}

      {/* Pipeline des statuts */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {PIPELINE.map((step, i) => {
          const n = byStatus[step.key] ?? 0;
          return (
            <div key={step.key} className="relative rounded-lg border border-border bg-card p-3 shadow-sm">
              <span
                className="absolute inset-y-2.5 left-0 w-[3px] rounded-r"
                style={{ background: n > 0 ? "var(--primary)" : "var(--border)" }}
              />
              {i < PIPELINE.length - 1 && (
                <ChevronRight className="absolute -right-[9px] top-1/2 z-10 size-3.5 -translate-y-1/2 bg-background text-muted-foreground/40 max-xl:hidden" />
              )}
              <div className={cn("font-mono text-2xl tabular-nums", n > 0 ? "font-medium text-foreground" : "text-muted-foreground/60")}>
                {nf.format(n)}
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-tight text-primary">{step.label}</div>
              <div className="text-[11px] text-muted-foreground">{step.sub}</div>
            </div>
          );
        })}
      </div>

      <VillesManager rows={rows} waves={byWave} aiReady={aiReady} />
    </div>
  );
}
