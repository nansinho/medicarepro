"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Play, Sparkles, TriangleAlert } from "lucide-react";
import {
  publishCities,
  queueGeneration,
  setReviewStatus,
  triggerWorker,
  unpublishCity,
  type VilleActionResult,
} from "@/app/admin/(protected)/villes/actions";
import { Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
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

const STATUS_VARIANT: Record<string, "green" | "amber" | "blue" | "gray"> = {
  approved: "green",
  needs_review: "amber",
  generated: "blue",
};

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
    <div className="flex flex-col gap-4">
      {notice && (
        <Notice tone={notice.ok ? "ok" : "bad"} title={notice.ok ? "Action effectuée" : "Erreur"}>
          {notice.message ?? (notice.ok ? "OK" : "Une erreur est survenue.")}
        </Notice>
      )}

      {/* Actions par vague */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Sparkles className="size-4 text-muted-foreground" />
            Génération et publication par vague
          </CardTitle>
          <Button size="sm" disabled={pending || !aiReady} onClick={() => run(() => triggerWorker())}>
            <Play />
            Lancer la génération
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {WAVES.map((wave) => {
              const w = waves[wave] ?? { total: 0, published: 0 };
              const pct = w.total > 0 ? Math.round((w.published / w.total) * 100) : 0;
              return (
                <div key={wave} className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-3.5">
                  <div className="flex items-baseline justify-between">
                    <b className="text-[13px] font-semibold text-foreground">Vague {wave}</b>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {w.published} / {w.total} publiées
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={pending || !aiReady}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("wave", String(wave));
                        run(() => queueGeneration(fd));
                      }}
                    >
                      <Sparkles />
                      Générer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("wave", String(wave));
                        run(() => publishCities(fd));
                      }}
                    >
                      Publier
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            La génération tourne en arrière-plan (worker). Sinon, le cron la traite toutes les 5 minutes.
          </p>
        </CardContent>
      </Card>

      {/* File de revue */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>À revoir</CardTitle>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{rows.length}</span>
        </CardHeader>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
            <p className="text-[13px] font-medium text-foreground">Aucune ville en attente de revue</p>
            <p className="text-xs text-muted-foreground">Les pages générées apparaîtront ici avant approbation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Ville</TableHead>
                  <TableHead className="w-20 text-right">Vague</TableHead>
                  <TableHead className="w-36">Statut</TableHead>
                  <TableHead className="w-28">À vérifier</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.region}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {row.wave}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "gray"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.claims.length > 0 ? (
                        <Badge variant="amber">{row.claims.length} fait(s)</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReviewing(row)}>
                          Revoir
                        </Button>
                        <Button variant="ghost" size="icon-sm" asChild aria-label="Aperçu de la page">
                          <a href={`/logiciel-podologue/${row.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Panneau de revue (latéral, pas de modal centré) */}
      <Sheet open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          {reviewing && (
            <>
              <SheetHeader>
                <SheetTitle>{reviewing.name}</SheetTitle>
                <SheetDescription>
                  {reviewing.region} · vague {reviewing.wave} ·{" "}
                  <Badge variant={STATUS_VARIANT[reviewing.status] ?? "gray"}>{reviewing.status}</Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {reviewing.claims.length > 0 && (
                  <div className="mb-4 rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/8 p-3.5">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[color:var(--warn)]">
                      <TriangleAlert className="size-4" />
                      Faits à vérifier avant d&apos;approuver
                    </div>
                    <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
                      {reviewing.claims.map((claim, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[color:var(--warn)]">•</span>
                          {claim}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={`/logiciel-podologue/${reviewing.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Ouvrir la page rendue
                  </a>
                </Button>
              </div>

              <SheetFooter className="flex-row gap-2">
                <Button
                  className="flex-1"
                  disabled={pending}
                  onClick={() => {
                    if (
                      reviewing.claims.length > 0 &&
                      !window.confirm(
                        "Avez-vous vérifié tous les faits locaux listés ? L'approbation vaut validation.",
                      )
                    )
                      return;
                    const fd = new FormData();
                    fd.set("cityId", reviewing.id);
                    fd.set("status", "approved");
                    run(() => setReviewStatus(fd), true);
                  }}
                >
                  Approuver
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("cityId", reviewing.id);
                    fd.set("status", "needs_review");
                    run(() => setReviewStatus(fd), true);
                  }}
                >
                  À retravailler
                </Button>
                {reviewing.status === "approved" && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("cityId", reviewing.id);
                      run(() => publishCities(fd), true);
                    }}
                  >
                    Publier
                  </Button>
                )}
                <SheetClose asChild>
                  <Button variant="ghost">Fermer</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* unpublishCity est exposé pour un futur écran « villes publiées ». */
void unpublishCity;
