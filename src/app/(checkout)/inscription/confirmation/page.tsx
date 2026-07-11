import type { Metadata } from "next";
import Link from "next/link";
import ConfirmationPoller from "@/components/checkout/ConfirmationPoller";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /inscription/confirmation?ref=<référence Monetico>
   Page de retour après le paiement carte : le suivi temps réel
   (poll du statut, relance du paiement…) est délégué au client
   <ConfirmationPoller/>. La référence est validée en forme
   (12 alphanum) — l'autorisation réelle repose sur le cookie
   httpOnly mp_checkout, vérifié par l'API de statut.
   ============================================================ */

export const metadata: Metadata = {
  title: "Confirmation d'inscription",
};

export default async function ConfirmationPage({
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
          <p className={s.centerTitle}>Référence introuvable</p>
          <p className={s.centerText}>
            Le lien de confirmation est incomplet. Suivez le lien reçu par
            email, ou contactez-nous à{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>.
          </p>
          <Link href="/" className={s.btnGhost}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return <ConfirmationPoller reference={reference} />;
}
