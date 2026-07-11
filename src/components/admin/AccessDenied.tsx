import Link from "next/link";
import { Lock } from "@/components/icons";
import s from "./Admin.module.css";

/* Carte « Accès réservé » des sections admin-only (facturation,
   réglages, utilisateurs…) — rendue DANS le shell, à la place du
   contenu de la section. */
export default function AccessDenied({
  email,
  scope,
}: {
  email: string;
  scope: string;
}) {
  return (
    <div className={s.denied}>
      <div className={s.deniedCard}>
        <div className={s.deniedIcon}>
          <Lock width={26} height={26} />
        </div>
        <h1>Accès réservé</h1>
        <p>
          Cette section ({scope}) est réservée aux administrateurs. Votre
          compte ({email}) a le rôle «&nbsp;éditeur&nbsp;» — contactez un
          administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une
          erreur.
        </p>
        <div className={s.deniedLinks}>
          <Link href="/admin/contenu">Retour au contenu</Link>
          <Link href="/admin/login">Changer de compte</Link>
        </div>
      </div>
    </div>
  );
}
