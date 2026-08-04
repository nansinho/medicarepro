"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { Notice } from "@/components/admin/shared";

/* ============================================================
   Écran d'erreur du back office. Le dépôt n'en avait aucun : une page
   qui échouait laissait l'écran précédent affiché, sans le moindre
   retour — ce qui participait beaucoup à l'impression que « ça fige ».

   Toutes les pages admin sont `force-dynamic` sur Supabase : le
   `reset()` historique ne relance PAS la requête. `unstable_retry`,
   lui, refait le rendu serveur du segment, ce qui est la seule action
   utile ici.
   ============================================================ */

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <PageStack>
      <PageHeader
        title="Cet écran n'a pas pu se charger"
        description="La requête vers la base a échoué. Rien n'a été modifié : vous pouvez réessayer sans risque."
      />
      <Notice
        tone="bad"
        title="Détail technique"
        action={
          <Button type="button" onClick={() => unstable_retry()}>
            <RotateCcw className="size-4" />
            Réessayer
          </Button>
        }
      >
        <p className="[overflow-wrap:anywhere]">{error.message}</p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Référence : {error.digest}
          </p>
        )}
      </Notice>
    </PageStack>
  );
}
