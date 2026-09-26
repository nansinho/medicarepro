"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeRole } from "@/app/admin/(protected)/utilisateurs/actions";

/* Rôle d'un membre, modifiable sur place. Le sien ne l'est pas (garde
   serveur aussi) : on ne se retire pas ses propres droits par mégarde. */
export default function MemberRoleSelect({
  userId,
  email,
  role,
}: {
  userId: string;
  email: string;
  role: "admin" | "editor";
}) {
  const [pending, start] = useTransition();

  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(next) => {
        if (next === role) return;
        start(async () => {
          const result = await changeRole(userId, next);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        });
      }}
    >
      <SelectTrigger size="sm" className="w-[150px]" aria-label={`Rôle de ${email}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="editor">Éditeur</SelectItem>
        <SelectItem value="admin">Administrateur</SelectItem>
      </SelectContent>
    </Select>
  );
}
