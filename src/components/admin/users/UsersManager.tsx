"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import {
  changeRole,
  createUserDirect,
  inviteUser,
  sendRecovery,
  toggleBan,
  type UserActionResult,
} from "@/app/admin/(protected)/utilisateurs/actions";
import { Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Gestion des comptes : invitation / création directe, rôle,
   réinitialisation, désactivation. Après chaque action réussie,
   router.refresh() recharge la liste côté serveur.
   ============================================================ */

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor";
  confirmed: boolean;
  banned: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/* Champs <select> natifs conservés (soumission de formulaire / état
   contrôlé), simplement restylés au registre shadcn. */
const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const ROLE_SELECT_CLASS =
  "h-8 rounded-md border border-input bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

/** Monogramme d'avatar (2 lettres) dérivé du nom affiché. */
function monogram(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase() || "?";
}

export default function UsersManager({
  users,
  selfId,
}: {
  users: AdminUserRow[];
  selfId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<UserActionResult | null>(null);
  const [mode, setMode] = useState<"invite" | "direct">("invite");

  function run(action: () => Promise<UserActionResult>) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  function handleNewUser(formData: FormData) {
    run(() => (mode === "invite" ? inviteUser(formData) : createUserDirect(formData)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Nouveau compte */}
      <Card>
        <CardHeader>
          <CardTitle>
            <UserPlus className="size-4 text-[color:var(--mp-blue-mid)]" />
            Ajouter un membre
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={handleNewUser} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                name="email"
                required
                placeholder="email@exemple.fr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-role">Rôle</Label>
              <select
                id="new-role"
                name="role"
                defaultValue="editor"
                aria-label="Rôle"
                className={SELECT_CLASS}
              >
                <option value="editor">Éditeur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-mode">Mode</Label>
              <select
                id="new-mode"
                aria-label="Mode de création"
                value={mode}
                onChange={(e) => setMode(e.target.value as "invite" | "direct")}
                className={SELECT_CLASS}
              >
                <option value="invite">Invitation par email</option>
                <option value="direct">Création directe</option>
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "En cours…" : mode === "invite" ? "Inviter" : "Créer"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            {mode === "invite"
              ? "La personne reçoit un lien (valable 24 h) pour choisir son mot de passe."
              : "Un mot de passe provisoire est généré, à transmettre vous-même."}
          </p>
        </CardContent>
      </Card>

      {notice && (
        <Notice
          tone={notice.ok ? "ok" : "bad"}
          title={notice.ok ? "Action effectuée" : "Erreur"}
        >
          {notice.message}
          {notice.ok && notice.password && (
            <code className="mt-2 block w-fit select-all rounded-md border border-dashed border-[color:var(--ok)]/40 bg-card px-3 py-1.5 font-mono text-[13px] text-foreground">
              {notice.password}
            </code>
          )}
        </Notice>
      )}

      {/* Liste des comptes */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[240px]">Membre</TableHead>
                <TableHead className="w-44">Rôle</TableHead>
                <TableHead className="w-40">Statut</TableHead>
                <TableHead className="w-44">Dernière connexion</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === selfId;
                return (
                  <TableRow key={user.id} className={user.banned ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15">
                          {monogram(user.displayName)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{user.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.email}
                            {isSelf && <span className="text-muted-foreground"> · vous</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="blue">
                          {user.role === "admin" ? "Administrateur" : "Éditeur"}
                        </Badge>
                      ) : (
                        <select
                          className={ROLE_SELECT_CLASS}
                          value={user.role}
                          disabled={pending}
                          onChange={(e) => {
                            const formData = new FormData();
                            formData.set("userId", user.id);
                            formData.set("role", e.target.value);
                            run(() => changeRole(formData));
                          }}
                          aria-label={`Rôle de ${user.email}`}
                        >
                          <option value="editor">Éditeur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="gray">Désactivé</Badge>
                      ) : user.confirmed ? (
                        <Badge variant="green">Actif</Badge>
                      ) : (
                        <Badge variant="amber">Invitation en attente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {user.lastSignInAt
                        ? DATE_FMT.format(new Date(user.lastSignInAt))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            const formData = new FormData();
                            formData.set("email", user.email);
                            run(() => sendRecovery(formData));
                          }}
                        >
                          <KeyRound />
                          Réinit. mdp
                        </Button>
                        {!isSelf && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            className={user.banned ? undefined : "text-bad hover:bg-bad/10 hover:text-bad"}
                            onClick={() => {
                              if (
                                user.banned ||
                                window.confirm(
                                  `Désactiver le compte de ${user.email} ? La personne ne pourra plus se connecter.`,
                                )
                              ) {
                                const formData = new FormData();
                                formData.set("userId", user.id);
                                formData.set("ban", String(!user.banned));
                                run(() => toggleBan(formData));
                              }
                            }}
                          >
                            {user.banned ? "Réactiver" : "Désactiver"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
