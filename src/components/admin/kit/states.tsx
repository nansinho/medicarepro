import type { ComponentType, ReactNode } from "react";
import { DatabaseZap, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ============================================================
   États d'écran — un traitement chacun.

   Le back office en comptait cinq différents pour le seul cas « rien à
   afficher » : un <p> nu, un bloc centré py-14, un bloc à pastille, un
   CardContent avec paragraphe, et rien du tout. Ici : un composant,
   trois variantes de contenant.

   Aucun de ces écrans n'invente de données : quand une table est vide,
   elle est vide, et on le dit avec la phrase juste.
   ============================================================ */

type EmptyStateProps = {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `row` s'insère dans un <tbody> : l'en-tête du tableau reste visible. */
  variant?: "inline" | "row" | "page";
  /** Nombre de colonnes du tableau (variante `row`). */
  colSpan?: number;
  className?: string;
};

function EmptyBody({
  icon: Icon = Inbox,
  title,
  description,
  action,
  dense,
}: Omit<EmptyStateProps, "variant" | "colSpan" | "className"> & {
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 px-6 text-center",
        dense ? "py-12" : "py-20",
      )}
    >
      <span className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
        <Icon className="size-4" />
      </span>
      <p className="mt-1 text-cell font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function EmptyState({
  variant = "inline",
  colSpan = 1,
  className,
  ...rest
}: EmptyStateProps) {
  if (variant === "row") {
    return (
      <tr>
        <td colSpan={colSpan} className={cn("p-0", className)}>
          <EmptyBody {...rest} dense />
        </td>
      </tr>
    );
  }

  if (variant === "page") {
    return (
      <Card className={className}>
        <CardContent className="p-0">
          <EmptyBody {...rest} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <EmptyBody {...rest} dense />
    </div>
  );
}

/**
 * « Rien ne correspond aux filtres » est un état DIFFÉRENT de « rien
 * n'existe encore » : le correctif n'est pas le même, donc le message
 * ni l'action ne le sont non plus.
 */
export function FilteredEmpty({
  summary,
  onReset,
  colSpan,
  variant = "inline",
}: {
  summary?: ReactNode;
  onReset?: ReactNode;
  colSpan?: number;
  variant?: "inline" | "row";
}) {
  return (
    <EmptyState
      variant={variant}
      colSpan={colSpan}
      title="Aucun résultat pour ces filtres"
      description={summary ?? "Élargissez la recherche ou réinitialisez les filtres."}
      action={onReset}
    />
  );
}

/**
 * Supabase non configuré : ce bloc était recopié à la main dans douze
 * pages, avec douze formulations.
 */
export function NotConfigured({ scope }: { scope: string }) {
  return (
    <Card>
      <CardContent className="p-0">
        <EmptyBody
          icon={DatabaseZap}
          title="Base de données non configurée"
          description={`${scope} nécessite une connexion Supabase. Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis rechargez.`}
          dense
        />
      </CardContent>
    </Card>
  );
}
