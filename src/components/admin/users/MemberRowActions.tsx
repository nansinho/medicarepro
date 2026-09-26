"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  cancelInvite,
  deleteMember,
  resendInvite,
  sendRecovery,
  setBanned,
  type MemberRowState,
} from "@/app/admin/(protected)/utilisateurs/actions";
import type { MemberStatus } from "@/components/admin/users/member-status";

/* ============================================================
   Actions d'un membre, selon son état :
   - invitation en attente ou expirée : renvoyer (nouveau lien), annuler ;
   - compte actif : lien de mot de passe, désactiver, supprimer ;
   - compte désactivé : réactiver, supprimer.

   Les gestes qui retirent un accès se confirment en deux temps, sur
   place, avec une phrase qui dit la conséquence : pas de fenêtre du
   navigateur au milieu de l'écran, validée par réflexe.
   ============================================================ */

type Confirmable = "cancel" | "disable" | "delete";

const CONFIRM: Record<Confirmable, { note: string; label: string }> = {
  cancel: { note: "Le lien cessera de fonctionner.", label: "Annuler l'invitation" },
  disable: { note: "Plus aucune connexion possible.", label: "Désactiver l'accès" },
  delete: { note: "Définitif, sans retour arrière.", label: "Supprimer le compte" },
};

export default function MemberRowActions({
  userId,
  email,
  status,
  isSelf,
}: {
  userId: string;
  email: string;
  status: MemberStatus;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<Confirmable | null>(null);

  const run = (fn: () => Promise<MemberRowState>) =>
    start(async () => {
      const result = await fn();
      setConfirming(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const link = result.link;
      toast.success(
        result.message,
        link
          ? {
              duration: 20_000,
              action: {
                label: "Copier le lien",
                onClick: () => void navigator.clipboard.writeText(link),
              },
            }
          : undefined,
      );
    });

  const confirmAction: Record<Confirmable, () => Promise<MemberRowState>> = {
    cancel: () => cancelInvite(userId),
    disable: () => setBanned(userId, true),
    delete: () => deleteMember(userId),
  };

  if (confirming) {
    const { note, label } = CONFIRM[confirming];
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{note}</span>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(confirmAction[confirming])}
          aria-label={`${label} : ${email}`}
        >
          {pending ? "En cours…" : label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(null)}
        >
          Garder
        </Button>
      </span>
    );
  }

  /* Suppression : icône seule (la ligne porte déjà deux boutons), nommée
     par l'infobulle et par aria-label. */
  const deleteButton = !isSelf && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Supprimer le compte de ${email}`}
          className="text-muted-foreground hover:bg-bad/10 hover:text-bad"
          onClick={() => setConfirming("delete")}
        >
          <Trash2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Supprimer le compte</TooltipContent>
    </Tooltip>
  );

  if (status === "invited" || status === "invite_expired") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={status === "invite_expired" ? "default" : "outline"}
          disabled={pending}
          onClick={() => run(() => resendInvite(userId))}
        >
          {pending ? "Envoi…" : "Renvoyer l'invitation"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming("cancel")}
        >
          Annuler
        </Button>
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setBanned(userId, false))}
        >
          Réactiver
        </Button>
        {deleteButton}
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
        onClick={() => run(() => sendRecovery(userId))}
      >
        {pending ? "Envoi…" : "Lien de mot de passe"}
      </Button>
      {!isSelf && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          className="text-bad hover:bg-bad/10 hover:text-bad"
          onClick={() => setConfirming("disable")}
        >
          Désactiver
        </Button>
      )}
      {deleteButton}
    </span>
  );
}
