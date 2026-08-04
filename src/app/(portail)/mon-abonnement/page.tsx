import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { hasCheckout, billingEnv, hasBilling } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import {
  monthlyPriceCents,
  checkoutAmountCents,
  formatEuros,
  planLabel,
  MAX_EXTRA_COLLABORATORS,
  type BillingPlan,
} from "@/lib/checkout/pricing";
import { openSession, PORTAL_COOKIE } from "@/lib/billing/portal";
import SubscribePanel from "@/components/portail/SubscribePanel";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   /mon-abonnement — espace abonnement du praticien.

   On y entre depuis le logiciel métier (bouton « Gérer mon abonnement »),
   via un lien à usage unique échangé contre un cookie de session. Il n'y a
   donc ni compte ni mot de passe à gérer ici.

   Deux états seulement pour l'instant (lot 1) :
   - aucun abonnement (le cas des cabinets utilisant le logiciel gratuitement)
     → panneau de souscription ;
   - abonnement en cours → état de l'abonnement.
   Résiliation, changement de carte et changement de formule viendront s'y
   ajouter, au même endroit.
   ============================================================ */

export const metadata: Metadata = {
  title: "Mon abonnement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  lien: "Ce lien n'est plus valable. Rouvrez votre espace depuis le bouton « Gérer mon abonnement » de votre logiciel.",
  indispo: "Service momentanément indisponible. Réessayez dans quelques minutes.",
};

function frDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

type SubRow = {
  id: string;
  plan: BillingPlan;
  extra_collaborators: number;
  renewal_amount_cents: number;
  status: string;
  current_period_end: string;
  recurrence_stopped_at: string | null;
  grace_until: string | null;
};

/** Un abonnement fini n'empêche pas d'en reprendre un. */
const OVER = new Set(["canceled", "expired"]);

export default async function MonAbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const errorKey = typeof sp.e === "string" ? sp.e : "";
  const jar = await cookies();
  const session = openSession(jar.get(PORTAL_COOKIE)?.value);

  /* --- Pas de session : on explique comment entrer, sans jamais dire si le
     cabinet existe ou non (aucune énumération possible). --- */
  if (!session) {
    return (
      <div className={s.shell}>
        <div className={s.centerCard}>
          <h1 className={s.centerTitle}>Espace abonnement</h1>
          <p className={s.centerText}>
            {ERRORS[errorKey] ??
              "Cet espace s'ouvre depuis votre logiciel MediCare Pro, par le bouton « Gérer mon abonnement » de la page Cabinet."}
          </p>
          <p className={s.centerText}>
            Besoin d&apos;aide&nbsp;?{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
          </p>
          <Link href="/" className={s.btnGhost}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const supabase = hasBilling() ? serviceClient() : null;
  const { data } = supabase
    ? await supabase
        .from("subscriptions")
        .select(
          "id, plan, extra_collaborators, renewal_amount_cents, status, current_period_end, recurrence_stopped_at, grace_until",
        )
        .eq("app_cabinet_id", session.appCabinetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const sub = (data as SubRow | null) ?? null;
  const cabinetName = session.cabinet.name || "votre cabinet";

  /* --- Aucun abonnement (ou abonnement terminé) : souscription. --- */
  if (!sub || OVER.has(sub.status)) {
    const open = hasCheckout();
    const { checkoutPlans } = open
      ? billingEnv()
      : { checkoutPlans: "annual" as const };
    const monthlyEnabled = open && (checkoutPlans === "all" || checkoutPlans === "monthly");
    const annualEnabled = open && (checkoutPlans === "all" || checkoutPlans === "annual");

    const prices = { MONTHLY: [], ANNUAL: [] } as {
      MONTHLY: { monthlyLabel: string; totalLabel: string }[];
      ANNUAL: { monthlyLabel: string; totalLabel: string }[];
    };
    for (const plan of ["MONTHLY", "ANNUAL"] as BillingPlan[]) {
      for (let n = 0; n <= MAX_EXTRA_COLLABORATORS; n++) {
        prices[plan].push({
          monthlyLabel: formatEuros(monthlyPriceCents(plan, n)),
          totalLabel: formatEuros(checkoutAmountCents(plan, n)),
        });
      }
    }

    return (
      <div className={s.shell}>
        <div className={s.head}>
          <h1 className={s.title}>
            {sub ? "Reprendre un abonnement" : "Activer votre abonnement"}
          </h1>
          <p className={s.subtitle}>
            {sub
              ? `L'abonnement de ${cabinetName} est terminé. Vous pouvez en reprendre un, sans rien perdre de vos données.`
              : `${cabinetName} utilise MediCare Pro sans abonnement. Choisissez votre formule pour le mettre en place.`}
          </p>
        </div>
        <div className={s.card}>
          <div className={s.cardBody}>
            {monthlyEnabled || annualEnabled ? (
              <SubscribePanel
                prices={prices}
                monthlyEnabled={monthlyEnabled}
                annualEnabled={annualEnabled}
                cabinetName={cabinetName}
              />
            ) : (
              <div className={s.alert}>
                <span>
                  La souscription en ligne est momentanément indisponible.
                  Écrivez-nous à{" "}
                  <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>{" "}
                  et nous la mettons en place avec vous.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --- Abonnement en cours. --- */
  const recurring = sub.plan === "MONTHLY" && !sub.recurrence_stopped_at;
  const label = planLabel(sub.plan, sub.extra_collaborators);

  return (
    <div className={s.shell}>
      <div className={s.head}>
        <h1 className={s.title}>Mon abonnement</h1>
        <p className={s.subtitle}>{cabinetName}</p>
      </div>

      {sub.status === "past_due" && (
        <div className={s.banner} role="alert">
          <span>
            Votre dernier paiement a été refusé par la banque. Votre accès reste
            entier
            {sub.grace_until ? ` jusqu'au ${frDate(sub.grace_until)}` : ""}.
            Écrivez-nous à contact@medicarepro.fr pour mettre à jour votre moyen
            de paiement.
          </span>
        </div>
      )}

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>{label}</div>
          <div className={s.cardDesc}>
            {formatEuros(sub.renewal_amount_cents)} TTC{" "}
            {sub.plan === "MONTHLY" ? "par mois" : "par an"}
          </div>
        </div>
        <div className={s.cardBody}>
          <div className={s.recapList}>
            <div>
              {recurring ? "Prochain prélèvement" : "Accès jusqu'au"}&nbsp;:{" "}
              <b>{frDate(sub.current_period_end)}</b>
            </div>
            <div>
              Reconduction automatique&nbsp;:{" "}
              <b>{recurring ? "active" : "non"}</b>
            </div>
          </div>

          <div className={s.alert}>
            <span>
              Pour changer de carte, changer de formule ou résilier, écrivez-nous
              à <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
              . Ces actions arriveront prochainement dans cet espace.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
