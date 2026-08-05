import type { Metadata } from "next";
import Link from "next/link";
import ConfirmationPoller from "@/components/checkout/ConfirmationPoller";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /inscription/echec?ref=<référence Monetico>

   POURQUOI CETTE PAGE EXISTE : Monetico EXIGE deux adresses de retour
   distinctes, `url_retour_ok` et `url_retour_err`. Le site envoyait la même
   pour les deux, ce que la banque a relevé. Ce n'est pas un détail de
   conformité : c'est le seul signal qui arrive dans le navigateur avant la
   notification serveur, donc la seule chose qui permet d'accueillir
   correctement quelqu'un dont la carte vient d'être refusée.

   Le contenu, lui, reste celui de la page de confirmation : le suivi
   interroge le VRAI statut du dossier auprès de l'API, et propose la relance.
   On ne se fie pas au chemin de retour pour affirmer un échec — c'est la
   banque qui tranche, par sa notification, pas la page sur laquelle le
   navigateur atterrit.
   ============================================================ */

export const metadata: Metadata = {
  title: "Paiement non abouti",
  robots: { index: false, follow: false },
};

export default async function EchecPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.ref === "string" ? sp.ref : "";
  const reference = /^[A-Z0-9]{12}$/.test(raw) ? raw : null;

  if (!reference) {
    return (
      <div className={s.shell}>
        <div className={s.centerCard}>
          <p className={s.centerTitle}>Votre paiement n&apos;a pas abouti</p>
          <p className={s.centerText}>
            Aucun montant n&apos;a été débité. Vous pouvez reprendre votre
            inscription, ou nous écrire à{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a> et
            nous la mettons en place avec vous.
          </p>
          <Link href="/inscription" className={s.btnPrimary}>
            Reprendre mon inscription
          </Link>
        </div>
      </div>
    );
  }

  return <ConfirmationPoller reference={reference} />;
}
