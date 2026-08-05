import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { paymentsInTestModeOnLiveSite } from "@/lib/env";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   Layout de l'espace abonnement du praticien (/mon-abonnement).

   Même habillage que le tunnel de vente : le praticien y arrive depuis son
   logiciel, il doit reconnaître MediCare Pro sans être invité à partir
   ailleurs (ni Header ni Footer du site vitrine).

   À la différence du tunnel, cet espace reste ACCESSIBLE même quand
   l'encaissement est fermé : consulter son abonnement, ses factures ou
   résilier n'exige aucune configuration de paiement. Seules les actions qui
   ouvrent une commande vérifient hasCheckout().
   ============================================================ */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PortailLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
            Espace abonnement
          </span>
        </div>
      </header>

      {/* Même garde que le tunnel de vente : l'espace abonnement encaisse lui
          aussi (reprise, changement de formule, changement de carte). Un
          praticien qui valide sa nouvelle formule ne doit pas se heurter à un
          refus muet parce que la caisse est restée en mode essai. */}
      {paymentsInTestModeOnLiveSite() && (
        <div className={s.banner} role="alert">
          <span>
            <strong>Paiement en cours de configuration.</strong> Les règlements
            par carte ne peuvent pas aboutir pour le moment&nbsp;: votre banque
            refusera la transaction. Écrivez-nous à{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>,
            nous prenons le relais.
          </span>
        </div>
      )}

      <main className={s.main}>{children}</main>

      <footer className={s.pageFoot}>
        Paiement sécurisé par Monetico (CIC) — MEDICARE PRO, SAS
      </footer>
    </div>
  );
}
