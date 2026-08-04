import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /mon-abonnement/merci — retour après le paiement de souscription.

   Le traitement (contrat, facture, remontée à l'application) se fait côté
   serveur à réception de la notification bancaire : cette page ne fait que
   confirmer, sans jamais affirmer que le paiement a abouti — c'est la banque
   qui tranche, pas la page de retour.
   ============================================================ */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Souscription",
  robots: { index: false, follow: false },
};

export default async function MerciPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const reference = typeof sp.ref === "string" ? sp.ref : "";

  return (
    <div className={s.shell}>
      {reference && (
        <div className={s.head}>
          <p className={s.subtitle}>
            <span className={s.refBadge}>Référence {reference}</span>
          </p>
        </div>
      )}
      <div className={s.centerCard}>
        <p className={s.centerTitle}>Merci, votre souscription est enregistrée</p>
        <p className={s.centerText}>
          Dès la confirmation de votre banque, votre abonnement est activé et
          vous recevez votre reçu et votre facture par email (pensez à vérifier
          vos courriers indésirables). Votre logiciel, vos utilisateurs et vos
          dossiers patients restent exactement en l&apos;état&nbsp;: rien
          n&apos;a été recréé.
        </p>
        <p className={s.centerText}>
          Une question&nbsp;?{" "}
          <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
        </p>
        <Link href="/mon-abonnement" className={s.btnGhost}>
          Voir mon abonnement
        </Link>
      </div>
    </div>
  );
}
