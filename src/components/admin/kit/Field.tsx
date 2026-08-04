import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ============================================================
   Champ de formulaire : libellé, contrôle, aide, erreur.

   Le triplet <div><Label/><Input/><p/></div> était recopié dans huit
   fichiers, avec huit rendus d'erreur différents.

   `justify-end` fait tout le travail d'alignement : la cellule occupe
   toute la hauteur de sa rangée de grille et pousse le couple
   libellé+contrôle vers le bas. Si un libellé passe sur deux lignes,
   son champ reste sur la même ligne de base que les autres — c'était
   le défaut le plus visible de l'écran Souscriptions.
   ============================================================ */

export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  span,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Classes de portée dans la grille — chaînes LITTÉRALES complètes. */
  span?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col justify-end gap-1.5", span, className)}
    >
      <Label htmlFor={htmlFor} className="leading-[1.35]">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {optional && (
          <span className="font-normal text-muted-foreground"> (facultatif)</span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Grille de champs. Douze colonnes une fois la colonne large, six
 * en dessous : les portées valides à 6 le sont aussi à 12 (chaque
 * rangée de 12 se coupe en deux rangées de 6), donc une seule classe
 * par champ suffit.
 */
export function FieldGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-3.5 @narrow/page:grid-cols-6 @wide/page:grid-cols-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Rangée d'actions d'un formulaire, ancrée en pied de carte. */
export function FormActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/50 px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * <select> natif habillé comme un Input. Le back office en pose une
 * demi-douzaine via des constantes SELECT_CLASS recopiées ; c'est la
 * même déclaration, à un seul endroit.
 */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-cell shadow-sm outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
