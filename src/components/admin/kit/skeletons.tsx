import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageStack } from "./layout";

/* ============================================================
   Squelettes de chargement.

   Ils reprennent LES MÊMES classes structurelles que les écrans réels
   (hauteur d'en-tête de tableau, rythme des lignes, rembourrage des
   cartes) : au remplacement, rien ne saute. Un squelette d'une autre
   largeur que la page qu'il annonce est pire que pas de squelette.
   ============================================================ */

export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-[46ch] max-w-full" />
    </div>
  );
}

/* Même silhouette que StatBand : tuiles séparées, rayon 22px, pastille ronde.
   Un squelette qui n'a pas la forme de ce qu'il annonce produit un saut de
   mise en page au moment où les données arrivent. */
export function SkeletonStatBand({ cells = 4 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: cells }).map((_, i) => (
        <div
          key={i}
          className="mp-glass rounded-[var(--r-lg)] px-5 pb-4 pt-[18px] shadow-[var(--mp-shadow-sm)]"
        >
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 10,
  cols = 5,
  title = true,
}: {
  rows?: number;
  cols?: number;
  title?: boolean;
}) {
  return (
    <Card className="overflow-clip">
      {title && (
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
      )}
      <div>
        <div className="flex h-8 items-center gap-4 border-b border-border px-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SkeletonForm({ fields = 8 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 @narrow/page:grid-cols-6 @wide/page:grid-cols-12">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 @narrow/page:col-span-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Squelette générique, hérité par tout segment sans loading.tsx propre. */
export function SkeletonPage() {
  return (
    <PageStack>
      <SkeletonPageHeader />
      <SkeletonStatBand />
      <SkeletonTable />
    </PageStack>
  );
}
