import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Cadre et rythme des pages du back office.

   UN SEUL rythme vertical : 20px entre blocs de page, porté par
   PageStack. Les pages ne fixent plus leur propre écart — c'est ce
   qui produisait la collision entre le `space-y-6` du layout de
   facturation et les `gap-4` / `gap-5` des pages.
   ============================================================ */

/** Empilement standard d'une page : blocs séparés de 20px. */
export function PageStack({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col gap-5", className)}>{children}</div>;
}

/**
 * En-tête de page : titre, description, actions à droite, et flèche de
 * retour optionnelle (les écrans de détail n'avaient jusqu'ici que le
 * fil d'Ariane pour remonter).
 *
 * `items-end` : les actions s'alignent sur la ligne de base du titre et
 * non sur celle de la description, qui les décrochait vers le bas.
 */
export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = "Retour",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backTo && (
          <Link
            href={backTo}
            aria-label={backLabel}
            className="mp-icon-btn mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-page-title text-[color:var(--mp-text)]">
            {title}
          </h1>
          {description && (
            /* 76ch : au-delà, l'œil perd la ligne. C'est aussi ce qui
               empêche une description de s'étirer sur 1700px. */
            <p className="mt-1 max-w-[76ch] text-cell text-[color:var(--mp-text-3)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/**
 * Grille de page à deux colonnes : le travail à gauche, un rail de
 * contexte à droite dès que la colonne est large.
 *
 * `items-start` porte tout le poids : sans lui la cellule du rail
 * s'étire et son `sticky` ne s'accroche jamais.
 */
export function PageColumns({
  aside,
  className,
  children,
}: {
  aside: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-5",
        "@wide/page:grid-cols-[minmax(0,1fr)_360px] @ultra/page:grid-cols-[minmax(0,1fr)_400px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex flex-col gap-5 @wide/page:sticky @wide/page:top-16">
        {aside}
      </aside>
    </div>
  );
}

/** Titre de section à l'intérieur d'une page (h2). */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 max-w-[76ch] text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
