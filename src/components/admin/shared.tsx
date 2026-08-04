import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "./kit/layout";

/* ============================================================
   Blocs partagés du back office.

   Ce module reste le point d'entrée historique (une vingtaine de pages
   l'importent) : les composants sont désormais habillés comme l'app
   praticien, mais leur signature ne bouge pas. Les nouveaux blocs
   vivent dans ./kit et sont importés directement par les pages qui les
   adoptent.
   ============================================================ */

export { PageHeader, PageStack, PageColumns, Section } from "./kit/layout";

/** Alias historique de PageHeader (même contrat). */
export function PageHeading(props: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return <PageHeader {...props} />;
}

export type Stat = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Valeur à zéro : rendue en gris, pour ne pas crier. */
  zero?: boolean;
  /** Libellé technique en chasse fixe (statuts SEEDED, GENERATED…). */
  mono?: boolean;
};

const BAND_COLS: Record<number, string> = {
  4: "md:grid-cols-4",
  6: "md:grid-cols-3 xl:grid-cols-6",
  7: "md:grid-cols-4 xl:grid-cols-7",
};

/**
 * Bandeau de mesures : un seul bloc bordé, cellules séparées par des
 * filets d'un pixel (technique gap-px sur fond border). Quel que soit
 * le nombre de mesures, aucune carte orpheline.
 *
 * Les valeurs sont en Figtree extrabold à chasse tabulaire : c'est le
 * chiffre signature de l'app praticien, et le repère visuel le plus
 * immédiat que les deux produits sont le même.
 *
 * Volontairement SANS courbe ni variation en pourcentage : le schéma ne
 * stocke aucune série temporelle. Une sparkline ici serait une donnée
 * inventée.
 */
export function StatBand({ stats }: { stats: Stat[] }) {
  const cols = BAND_COLS[stats.length] ?? "md:grid-cols-4";
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-md",
        cols,
      )}
    >
      {stats.map((stat, i) => (
        <div key={i} className="min-w-0 bg-card px-5 pb-4 pt-3.5">
          <div
            className={cn(
              "truncate text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--mp-text-3)]",
              stat.mono && "font-mono tracking-tight normal-case",
            )}
          >
            {stat.label}
          </div>
          <div
            className={cn(
              "mt-1 font-display text-[28px] leading-none tabular-nums",
              stat.zero
                ? "font-bold text-[color:var(--mp-text-3)]"
                : "font-extrabold text-[color:var(--mp-text)]",
            )}
          >
            {stat.value}
          </div>
          {stat.hint && (
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {stat.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Bandeau d'alerte (info / succès / attention / danger). */
export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "ok" | "warn" | "bad";
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "border-border bg-card",
    ok: "border-[color:var(--ok)]/30 bg-[color:var(--ok)]/8",
    warn: "border-[color:var(--warn)]/30 bg-[color:var(--warn)]/8",
    bad: "border-destructive/30 bg-destructive/8",
  } as const;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-cell shadow-sm",
        tones[tone],
      )}
    >
      <div className="min-w-0 flex-1 text-muted-foreground">
        {title && <div className="mb-0.5 font-medium text-foreground">{title}</div>}
        {children}
      </div>
      {action && <div className="flex-none self-center">{action}</div>}
    </div>
  );
}
