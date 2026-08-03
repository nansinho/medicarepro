import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { verifyRenewalToken } from "@/lib/billing/renewal-link";
import { renewalAmountCents, formatEuros } from "@/lib/checkout/pricing";
import RenewButton from "@/components/checkout/RenewButton";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /renouvellement?t=<jeton> — renouvellement d'un abonnement
   annuel (offre one-shot). Le jeton signé identifie la
   souscription ; on affiche un récap et un bouton de paiement.
   Server component en lecture seule ; le paiement passe par
   POST /api/checkout/renew.
   ============================================================ */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Renouvellement",
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

function Invalid({ message }: { message: string }) {
  return (
    <div className={s.shell}>
      <div className={s.centerCard}>
        <p className={s.centerTitle}>Lien indisponible</p>
        <p className={s.centerText}>{message}</p>
        <p className={s.centerText}>
          Écrivez-nous à{" "}
          <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>.
        </p>
      </div>
    </div>
  );
}

export default async function RenouvellementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const subscriptionId = verifyRenewalToken(token);
  if (!subscriptionId) {
    return <Invalid message="Ce lien de renouvellement est invalide ou expiré." />;
  }

  const service = serviceClient();
  if (!service) {
    return <Invalid message="Service momentanément indisponible." />;
  }

  const { data } = await service
    .from("subscriptions")
    .select(
      "plan, status, cabinet_name, current_period_end, extra_collaborators",
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!data) {
    return <Invalid message="Abonnement introuvable." />;
  }
  const sub = data as {
    plan: "MONTHLY" | "ANNUAL";
    status: string;
    cabinet_name: string;
    current_period_end: string;
    extra_collaborators: number;
  };

  if (sub.plan !== "ANNUAL") {
    return (
      <Invalid message="Le renouvellement en ligne ne concerne que l'offre 12 mois. Votre abonnement mensuel se reconduit automatiquement." />
    );
  }
  if (sub.status === "canceled") {
    return (
      <Invalid message="Cet abonnement est résilié. Contactez-nous pour le réactiver." />
    );
  }

  const amount = formatEuros(
    renewalAmountCents("ANNUAL", sub.extra_collaborators),
  );
  const expires = dateFmt.format(new Date(sub.current_period_end));

  return (
    <div className={s.shell}>
      <div className={s.head}>
        <h1 className={s.title}>Renouveler votre abonnement</h1>
        <p className={s.subtitle}>
          Offre 12 mois — <strong>{sub.cabinet_name}</strong>
        </p>
      </div>

      <div className={s.centerCard}>
        <p className={s.centerText}>
          Votre accès est actuellement garanti jusqu&apos;au{" "}
          <strong>{expires}</strong>. En renouvelant, vous prolongez votre
          cabinet de <strong>12 mois</strong> — vos données restent intactes.
        </p>
        <p className={s.centerTitle}>{amount} TTC</p>
        <p className={s.centerText}>
          Paiement unique par carte, sans reconduction automatique.
        </p>
        <RenewButton token={token} amountLabel={amount} />
      </div>
    </div>
  );
}
