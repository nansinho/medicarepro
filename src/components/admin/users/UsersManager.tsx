"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeRole,
  createUserDirect,
  inviteUser,
  sendRecovery,
  toggleBan,
  type UserActionResult,
} from "@/app/admin/(protected)/utilisateurs/actions";
import s from "../Admin.module.css";
import u from "./users.module.css";

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
    <div className={u.wrap}>
      {/* Nouveau compte */}
      <section className={u.newUser}>
        <h2>Ajouter un membre</h2>
        <form action={handleNewUser} className={u.newForm}>
          <input
            type="email"
            name="email"
            required
            placeholder="email@exemple.fr"
            aria-label="Email du nouveau membre"
          />
          <select name="role" aria-label="Rôle" defaultValue="editor">
            <option value="editor">Éditeur</option>
            <option value="admin">Administrateur</option>
          </select>
          <select
            aria-label="Mode de création"
            value={mode}
            onChange={(e) => setMode(e.target.value as "invite" | "direct")}
          >
            <option value="invite">Invitation par email</option>
            <option value="direct">Création directe</option>
          </select>
          <button type="submit" disabled={pending}>
            {pending ? "En cours…" : mode === "invite" ? "Inviter" : "Créer"}
          </button>
        </form>
        <p className={u.newHelp}>
          {mode === "invite"
            ? "La personne reçoit un lien (valable 24 h) pour choisir son mot de passe."
            : "Un mot de passe provisoire est généré — à transmettre vous-même."}
        </p>
      </section>

      {notice && (
        <div
          className={notice.ok ? u.noticeOk : u.noticeErr}
          role={notice.ok ? "status" : "alert"}
        >
          <p>{notice.message}</p>
          {notice.ok && notice.password && (
            <code className={u.password}>{notice.password}</code>
          )}
        </div>
      )}

      {/* Liste des comptes */}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === selfId;
              return (
                <tr key={user.id} className={user.banned ? u.rowBanned : undefined}>
                  <td>
                    <span className={s.tdMain}>{user.displayName}</span>
                    <span className={s.tdSub}>
                      {user.email}
                      {isSelf ? " · vous" : ""}
                    </span>
                  </td>
                  <td>
                    {isSelf ? (
                      <span className={`${s.badge} ${s.tBlue}`}>
                        {user.role === "admin" ? "Administrateur" : "Éditeur"}
                      </span>
                    ) : (
                      <select
                        className={u.roleSelect}
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
                  </td>
                  <td>
                    {user.banned ? (
                      <span className={`${s.badge} ${s.tRed}`}>Désactivé</span>
                    ) : user.confirmed ? (
                      <span className={`${s.badge} ${s.tGreen}`}>Actif</span>
                    ) : (
                      <span className={`${s.badge} ${s.tAmber}`}>
                        Invitation en attente
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={s.tdSub}>
                      {user.lastSignInAt
                        ? DATE_FMT.format(new Date(user.lastSignInAt))
                        : "—"}
                    </span>
                  </td>
                  <td>
                    <div className={s.rowActions}>
                      <button
                        type="button"
                        className={s.btnSmall}
                        disabled={pending}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set("email", user.email);
                          run(() => sendRecovery(formData));
                        }}
                      >
                        Réinit. mdp
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className={s.btnSmallDanger}
                          disabled={pending}
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
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
