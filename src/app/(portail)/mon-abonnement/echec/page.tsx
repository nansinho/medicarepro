import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /mon-abonnement/echec?ref=<référence>

   Retour d'un paiement refusé dans l'espace abonnement (souscription d'un
   cabinet existant, reprise, changement de formule ou de carte). Existe parce
   que Monetico exige deux adresses de retour distinctes, et parce qu'un
   praticien refusé atterrissait sur un écran de remerciement.

   Point important à lui dire, et vrai quel que soit le motif du refus : sa
   demande enregistrée n'est pas perdue. Elle reste en attente, il peut
   simplement recommencer le paiement depuis son espace.
   ============================================================ */

export const dynamic = "force-dynamic";
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
          débité</b>, et votre abonnement n&apos;a pas été modifié.
        </p>
        <p className={s.centerText}>
          Votre demande reste enregistrée&nbsp;: vous pouvez relancer le
          paiement depuis votre espace, avec la même carte ou une autre. Si le
          refus se répète, écrivez-nous à{" "}
          <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>.
        </p>
        <Link href="/mon-abonnement" className={s.btnPrimary}>
          Retour à mon abonnement
        </Link>
      </div>
    </div>
  );
}
