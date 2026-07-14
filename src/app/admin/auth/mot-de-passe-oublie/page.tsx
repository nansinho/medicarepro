import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "@/components/icons";
import ForgotForm from "./ForgotForm";
import styles from "../../login/login.module.css";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function MotDePasseOubliePage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique */}
          <img src="/logo.svg?v=6" alt="MediCare Pro" width={184} height={38} />
          <span className={styles.kicker}>
            <Lock width={12} height={12} /> Back office
          </span>
        </div>
        <h1>Mot de passe oublié</h1>
        <p className={styles.lead}>
          Indiquez votre email : si un compte existe, vous recevrez un lien
          pour définir un nouveau mot de passe.
        </p>
        <ForgotForm />
        <Link href="/admin/login" className={styles.backLink}>
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
