import type { Metadata } from "next";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /renouvellement/echec?ref=<référence>

   Retour d'un renouvellement annuel refusé. Existe parce que Monetico exige
   deux adresses distinctes (`url_retour_ok` / `url_retour_err`), et parce
   qu'un client refusé atterrissait jusqu'ici sur « Merci, votre renouvellement
   est pris en compte » — le contraire de ce qui venait de se passer.

   Ce qu'on affirme ici est vrai dans tous les cas : un refus ne débite rien,
   et l'abonnement en cours n'est pas touché. On ne dit rien de plus, la
   notification bancaire faisant seule foi sur le sort du paiement.
   ============================================================ */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Renouvellement non abouti",
  robots: { index: false, follow: false },
};

export default async function RenouvellementEchecPage({
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
        <p className={s.centerTitle}>Votre paiement n&apos;a pas abouti</p>
        <p className={s.centerText}>
          Votre banque a refusé la transaction. <b>Aucun montant n&apos;a été
          débité</b> et votre abonnement en cours n&apos;est pas modifié&nbsp;:
          il court jusqu&apos;à son terme.
        </p>
        <p className={s.centerText}>
          Vous pouvez réessayer depuis le lien de renouvellement reçu par email,
          avec la même carte ou une autre. Si le refus se répète, votre banque
          seule peut vous en donner la raison — écrivez-nous à{" "}
          <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a> et
          nous trouvons une solution avec vous.
        </p>
      </div>
    </div>
  );
}
