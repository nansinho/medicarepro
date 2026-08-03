import type { Metadata } from "next";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /renouvellement/merci — page de retour après le paiement de
   renouvellement. Le traitement (prolongation, facture) se fait
   côté serveur à réception de l'IPN ; on confirme simplement au
   client et on le renvoie vers son reçu par email.
   ============================================================ */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Renouvellement",
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
        <p className={s.centerTitle}>Merci, votre renouvellement est pris en compte</p>
        <p className={s.centerText}>
          Dès la confirmation de votre banque, votre abonnement 12 mois est
          prolongé et vous recevez votre reçu et votre facture par email
          (pensez à vérifier vos courriers indésirables). Vous pouvez fermer
          cette page en toute sécurité.
        </p>
        <p className={s.centerText}>
          Une question&nbsp;?{" "}
          <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
        </p>
      </div>
    </div>
  );
}
