import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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

/**
 * Ton d'une mesure. Mêmes noms et mêmes tokens que `MetricCard` de l'app
 * praticien : une famille bleue (primary, sky, navy) plus l'ambre et le vert,
 * réservés au SENS (attention, validé). Chaque ton a un pendant en mode nuit,
 * sans quoi un navy en dur disparaît sur fond navy.
 */
export type StatTone = "primary" | "sky" | "navy" | "amber" | "success";

const TONE_STYLES: Record<StatTone, { bg: string; color: string }> = {
  primary: { bg: "var(--mp-tone-primary-bg)", color: "var(--mp-tone-primary)" },
  sky: { bg: "var(--mp-tone-sky-bg)", color: "var(--mp-tone-sky)" },
  navy: { bg: "var(--mp-tone-navy-bg)", color: "var(--mp-tone-navy)" },
  amber: { bg: "var(--mp-tone-amber-bg)", color: "var(--mp-tone-amber)" },
  success: { bg: "var(--mp-tone-success-bg)", color: "var(--mp-tone-success)" },
};

export type Stat = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Valeur à zéro : rendue en gris, pour ne pas crier. */
  zero?: boolean;
  /** Libellé technique en chasse fixe (statuts SEEDED, GENERATED…). */
  mono?: boolean;
  /** Icône de la pastille. Sans elle, la tuile s'affiche sans pastille. */
  icon?: LucideIcon;
  /** Ton de la pastille. Défaut : primary. */
  tone?: StatTone;
};

const BAND_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-3 xl:grid-cols-5",
  6: "md:grid-cols-3 xl:grid-cols-6",
  7: "md:grid-cols-4 xl:grid-cols-7",
};

/**
 * Mesures de tête de page.
 *
 * REPRISE FIDÈLE de `MetricCard` de l'app praticien : tuiles séparées, rayon
 * 22px, surface translucide posée sur le halo, et surtout la PASTILLE RONDE
 * teintée en haut à droite. C'est elle le repère : sans elle, les deux
 * produits se lisent comme deux outils différents, quand bien même les
 * couleurs et la typographie sont les mêmes.
 *
 * L'ancien rendu — un seul bandeau à filets d'un pixel — évitait la carte
 * orpheline sur un nombre impair de mesures, mais au prix de la seule
 * signature visuelle qui rapprochait le back office de l'app. On reprend donc
 * les tuiles, et on choisit les colonnes pour que les rangées tombent juste.
 *
 * Toujours SANS courbe ni variation : le schéma ne stocke aucune série
 * temporelle, et une sparkline serait ici une donnée inventée.
 */
export function StatBand({ stats }: { stats: Stat[] }) {
  const cols = BAND_COLS[stats.length] ?? "md:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-2 gap-3", cols)}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const tone = TONE_STYLES[stat.tone ?? "primary"];
        return (
          <div
            key={i}
            className="mp-glass min-w-0 rounded-[var(--r-lg)] px-5 pb-4 pt-[18px] shadow-[var(--mp-shadow-sm)]"
          >
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <span
                className={cn(
                  "min-w-0 truncate text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--mp-text-3)]",
                  stat.mono && "font-mono tracking-tight normal-case",
                )}
              >
                {stat.label}
              </span>
              {Icon && (
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{ background: tone.bg, color: tone.color }}
                  aria-hidden="true"
                >
                  <Icon className="size-[18px]" />
                </span>
              )}
            </div>
            <div
              className={cn(
                "font-display text-[28px] leading-none tabular-nums",
                stat.zero
                  ? "font-bold text-[color:var(--mp-text-3)]"
                  : "font-extrabold text-[color:var(--mp-text)]",
              )}
            >
              {stat.value}
            </div>
            {stat.hint && (
              <div className="mt-1.5 truncate text-xs text-[color:var(--mp-text-3)]">
                {stat.hint}
              </div>
            )}
          </div>
        );
      })}
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
