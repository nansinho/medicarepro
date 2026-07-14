import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock } from "@/components/icons";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Connexion au back office",
  robots: { index: false, follow: false },
};

/* Page de connexion du back office. Un staff déjà connecté est
   redirigé vers /admin par le proxy avant d'arriver ici. */
export default function AdminLoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : next/image ne l'optimiserait pas */}
          <img src="/logo.svg?v=5" alt="MediCare Pro" width={203} height={32} />
          <span className={styles.kicker}>
            <Lock width={12} height={12} /> Back office
          </span>
        </div>

        <h1>Connexion</h1>
        <p className={styles.lead}>
          Espace réservé à l&apos;équipe MediCare&nbsp;Pro.
        </p>

        <LoginForm />

        <div className={styles.linksRow}>
          <Link href="/admin/auth/mot-de-passe-oublie" className={styles.backLink}>
            Mot de passe oublié ?
          </Link>
          <Link href="/" className={styles.backLink}>
            Retour au site <ArrowRight width={14} height={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}
