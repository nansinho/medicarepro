import type { Metadata } from "next";
import Link from "next/link";
import { hasBilling, missingBillingEnv } from "@/lib/env";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   Layout du tunnel d'inscription payante (/inscription).
   Volontairement minimal : logo → accueil, fond clair, ni Header
   ni Footer du site — rien qui invite à quitter le paiement.
   Si la configuration billing est incomplète, le tunnel reste
   FERMÉ : on affiche un écran d'indisponibilité sobre (les noms
   des variables manquantes ne sont JAMAIS rendus au client).
   ============================================================ */

/* Pages transactionnelles : jamais indexées. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/* L'ouverture du tunnel dépend de l'env au moment de la requête,
   pas au moment du build. */
export const dynamic = "force-dynamic";

export default function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const open = hasBilling();
  if (!open) {
    // Noms (jamais les valeurs) des variables manquantes — logs serveur uniquement.
    console.warn(
      `[checkout] tunnel fermé — configuration billing incomplète : ${missingBillingEnv().join(", ")}`,
    );
  }

  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link href="/" aria-label="Retour à l'accueil MediCare Pro">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : next/image ne l'optimiserait pas */}
            <img
              src="/logo.svg?v=4"
              alt="MediCare Pro"
              width={156}
              height={32}
              className={s.logoImg}
            />
          </Link>
          <span className={s.topbarNote}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Paiement sécurisé
          </span>
        </div>
      </header>

      <main className={s.main}>
        {open ? (
          children
        ) : (
          <div className={s.shell}>
            <div className={s.centerCard}>
              <div className={s.statusIconWarn} aria-hidden="true">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className={s.centerTitle}>
                Inscription momentanément indisponible
              </h1>
              <p className={s.centerText}>
                L&apos;inscription en ligne est momentanément indisponible.
                Contactez-nous&nbsp;:{" "}
                <a href="mailto:contact@medicarepro.fr">
                  contact@medicarepro.fr
                </a>
              </p>
              <Link href="/" className={s.btnGhost}>
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className={s.pageFoot}>
        Paiement sécurisé par Monetico (CIC) — MEDICARE PRO, SAS
      </footer>
    </div>
  );
}
