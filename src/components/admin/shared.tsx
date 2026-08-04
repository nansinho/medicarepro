import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Blocs partagés du back office (registre Vercel/Stripe).
   Rendu serveur, sans état : utilisables depuis n'importe quelle
   page. Consomment les tokens shadcn scopés (.admin-scope).
   ============================================================ */

/** En-tête de page : titre, description, actions à droite. */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-[92ch] text-[13px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  );
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
 */
export function StatBand({ stats }: { stats: Stat[] }) {
  const cols = BAND_COLS[stats.length] ?? "md:grid-cols-4";
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-sm",
        cols,
      )}
    >
      {stats.map((stat, i) => (
        <div key={i} className="min-w-0 bg-card px-4 pb-3.5 pt-3">
          <div
            className={cn(
              "truncate text-xs text-muted-foreground",
              stat.mono && "font-mono text-[11px] tracking-tight",
            )}
          >
            {stat.label}
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-2xl tracking-tight tabular-nums",
              stat.zero
                ? "font-normal text-muted-foreground/70"
                : "font-medium text-foreground",
            )}
          >
            {stat.value}
          </div>
          {stat.hint && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
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
    ok: "border-[color:var(--ok)]/30 bg-[color:var(--ok)]/8 text-foreground",
    warn: "border-[color:var(--warn)]/30 bg-[color:var(--warn)]/8",
    bad: "border-destructive/30 bg-destructive/8",
  } as const;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5 text-[13px] shadow-sm",
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
