import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import {
  canCollectPayment,
  paymentProvider,
  missingCheckoutEnv,
  missingStripeEnv,
  paymentsInTestModeOnLiveSite,
} from "@/lib/env";
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
  /* L'ouverture dépend du prestataire RETENU : exiger la configuration Monetico
     fermerait le tunnel alors que Stripe encaisse, et l'inverse le laisserait
     ouvert sur une caisse absente. */
  const open = canCollectPayment();
  const testMode = paymentsInTestModeOnLiveSite();
  if (testMode) {
    console.warn(
      "[checkout] MODE TEST sur le site en ligne : aucune carte réelle ne peut aboutir.",
    );
  }
  if (!open) {
    // Noms (jamais les valeurs) des variables manquantes — logs serveur uniquement.
    const manquantes =
      paymentProvider() === "stripe" ? missingStripeEnv() : missingCheckoutEnv();
    console.warn(
      `[checkout] tunnel fermé — configuration d'encaissement incomplète : ${manquantes.join(", ")}`,
    );
  }

  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link href="/" aria-label="Retour à l'accueil MediCare Pro">
            <BrandLogo size={38} />
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

      {/* MODE TEST : on le DIT au visiteur, au lieu de le laisser essuyer des
          refus. Le 05/08/2026, un praticien a tenté quatre fois de régler
          478,08 € sur la plateforme d'essai de Monetico : quatre refus
          « Interdit », aucune explication, et il est parti. Une carte réelle ne
          peut PAS aboutir dans ce mode — le taire, c'est faire perdre son temps
          à un client et le laisser croire que le service est cassé.

          Ce bandeau n'apparaît que sur une anomalie de configuration : en
          production normale il n'existe pas, et en local il ne s'allume pas
          (cf. paymentsInTestModeOnLiveSite). */}
      {testMode && (
        <div className={s.banner} role="alert">
          <span>
            <strong>Paiement en cours de configuration.</strong> Les règlements
            par carte ne peuvent pas aboutir pour le moment&nbsp;: votre banque
            refusera la transaction, quelle que soit votre carte. Écrivez-nous à{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a> et
            nous mettons votre abonnement en place avec vous, sans attendre.
          </span>
        </div>
      )}

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
        {/* Le prestataire est lu, jamais codé en dur : afficher « Monetico »
            à un praticien qui vient de payer par Stripe est faux, et c'est
            exactement ce que la page montrait encore le 05/08/2026. */}
        Paiement sécurisé par {paymentProvider() === "stripe" ? "Stripe" : "Monetico (CIC)"} — MEDICARE PRO, SAS
      </footer>
    </div>
  );
}
