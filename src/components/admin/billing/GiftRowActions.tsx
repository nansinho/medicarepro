"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  renvoyerInvitation,
  retirerInvitation,
  type GiftRowState,
} from "@/app/admin/(protected)/billing/acces-offerts/actions";

/* ============================================================
   Actions d'une invitation encore en attente : la renvoyer (nouveau lien,
   l'ancien cesse de fonctionner) ou la retirer.

   Le retrait se confirme en deux temps, sur place : pas de fenêtre de
   confirmation du navigateur, qui s'ouvre au milieu de l'écran et se valide
   par réflexe.
   ============================================================ */

export default function GiftRowActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirmRetrait, setConfirmRetrait] = useState(false);

  const executer = (fn: (id: string) => Promise<GiftRowState>) =>
    start(async () => {
      const resultat = await fn(id);
      setConfirmRetrait(false);
      if (!resultat) return;
      if (!resultat.ok) {
        toast.error(resultat.error);
        return;
      }
      const lien = resultat.link;
      toast.success(
        resultat.message,
        lien
          ? {
              duration: 20_000,
              action: {
                label: "Copier le lien",
                onClick: () => void navigator.clipboard.writeText(lien),
              },
            }
          : undefined,
      );
    });

  if (confirmRetrait) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => executer(retirerInvitation)}
        >
          Confirmer le retrait
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirmRetrait(false)}
        >
          Annuler
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => executer(renvoyerInvitation)}
      >
        {pending ? "Envoi…" : "Renvoyer"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirmRetrait(true)}
      >
        Retirer
      </Button>
    </span>
  );
}
