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
import {
  activeChange,
  targetOf,
  isPayableNow,
  payableFrom,
} from "@/lib/billing/changes";
import SubscribePanel from "@/components/portail/SubscribePanel";
import SubscriptionSpace, {
  type PortalChange,
  type PortalInvoice,
} from "@/components/portail/SubscriptionSpace";
import s from "@/components/checkout/Checkout.module.css";
/* L'écran d'activation appartient à l'espace abonnement, pas au tunnel de
   vente : il en emprunte donc la mise en page (colonne de 1060 px, en-tête
   « hero »), sinon le praticien change de largeur et de typographie entre
   la souscription et la console qui la suit. */
import p from "@/components/portail/Portal.module.css";

/* ============================================================
   /mon-abonnement — espace abonnement du praticien.

   On y entre depuis le logiciel métier (bouton « Gérer mon abonnement »), via
   un lien à usage unique échangé contre un cookie de session. Il n'y a donc ni
   compte ni mot de passe à gérer ici.

   Trois états :
   - aucune session → mode d'emploi pour entrer, sans jamais révéler si le
     cabinet existe (aucune énumération possible) ;
   - aucun abonnement, ou abonnement terminé → panneau de souscription ;
   - abonnement en cours → la console complète (état, changement de formule,
     changement de carte, résiliation, factures).

   TOUT CE QUI S'AFFICHE EST CALCULÉ ICI : montants, dates, et le droit même
   de payer. Le composant client ne recalcule rien, il ne peut donc pas
   proposer une action que le serveur refusera.
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

/** Libellés de facture côté client : la nature de la pièce, pas son code. */
const INVOICE_KINDS: Record<string, string> = {
  card_first: "Première échéance",
  card_renewal: "Échéance",
  sdd_renewal: "Échéance",
  credit_note: "Avoir",
};

/** La période déjà réglée court-elle encore ? */
function isPeriodRunning(periodEndIso: string): boolean {
  return new Date(periodEndIso).getTime() > Date.now();
}

function frDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

type SubRow = {
  id: string;
  app_cabinet_id: string;
  cabinet_name: string;
  cabinet_address: string | null;
  cabinet_postal_city: string | null;
  admin_email: string;
  admin_name: string;
  invoice_prefix: string;
  plan: BillingPlan;
  extra_collaborators: number;
  renewal_amount_cents: number;
  status: string;
  current_period_end: string;
  recurrence_stopped_at: string | null;
  grace_until: string | null;
  last_failure_at: string | null;
};

const SUB_COLUMNS =
  "id, app_cabinet_id, cabinet_name, cabinet_address, cabinet_postal_city, admin_email, admin_name, invoice_prefix, plan, extra_collaborators, renewal_amount_cents, status, current_period_end, recurrence_stopped_at, grace_until, last_failure_at";

/** Un abonnement fini n'empêche pas d'en reprendre un. */
const OVER = new Set(["canceled", "expired"]);

/** Grille tarifaire complète, calculée côté serveur pour tous les cas. */
function priceTable() {
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
  return prices;
}

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
        .select(SUB_COLUMNS)
        .eq("app_cabinet_id", session.appCabinetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const sub = (data as SubRow | null) ?? null;
  const cabinetName = session.cabinet.name || sub?.cabinet_name || "votre cabinet";

  const open = hasCheckout();
  const { checkoutPlans } = open
    ? billingEnv()
    : { checkoutPlans: "annual" as const };
  const monthlyEnabled =
    open && (checkoutPlans === "all" || checkoutPlans === "monthly");
  const annualEnabled =
    open && (checkoutPlans === "all" || checkoutPlans === "annual");

  /* --- Aucun abonnement (ou abonnement terminé) : souscription. --- */
  if (!sub || OVER.has(sub.status)) {
    return (
      <div className={p.space}>
        <div className={p.hero}>
          <div className={p.heroText}>
            <h1 className={p.title}>
              {sub ? "Reprendre un abonnement" : "Activer votre abonnement"}
            </h1>
            <p className={p.subtitle}>
              {sub
                ? `L'abonnement de ${cabinetName} est terminé. Vous pouvez en reprendre un, sans rien perdre de vos données.`
                : `${cabinetName} utilise MediCare Pro sans abonnement. Choisissez votre formule pour le mettre en place.`}
            </p>
          </div>
        </div>
        {monthlyEnabled || annualEnabled ? (
          <SubscribePanel
            prices={priceTable()}
            monthlyEnabled={monthlyEnabled}
            annualEnabled={annualEnabled}
            cabinetName={cabinetName}
          />
        ) : (
          <div className={`${p.notice} ${p.noticeWarn}`}>
            <span className={p.noticeAccent} aria-hidden="true" />
            <div className={p.noticeBody}>
              <div className={p.noticeTitle}>
                Souscription momentanément indisponible
              </div>
              <div className={p.noticeText}>
                Écrivez-nous à{" "}
                <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>{" "}
                et nous la mettons en place avec vous.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* --- Abonnement en cours : la console. --- */

  const service = serviceClient();
  const pending = service ? await activeChange(service, sub.id) : null;

  /* Les factures du contrat. Limitées à ce qui se consulte réellement : au
     delà, c'est le comptable qui prend le relais, pas cette page. */
  const { data: invoiceRows } = service
    ? await service
        .from("invoices")
        .select("id, number, kind, amount_cents, issued_at")
        .eq("subscription_id", sub.id)
        .order("issued_at", { ascending: false })
        .limit(24)
    : { data: null };

  const invoices: PortalInvoice[] = (invoiceRows ?? []).map((row) => {
    const invoice = row as {
      id: string;
      number: string;
      kind: string;
      amount_cents: number;
      issued_at: string;
    };
    return {
      id: invoice.id,
      number: invoice.number,
      issuedAtLabel: frDate(invoice.issued_at),
      amountLabel: formatEuros(invoice.amount_cents),
      kindLabel: INVOICE_KINDS[invoice.kind] ?? "Facture",
    };
  });

  let change: PortalChange | null = null;
  if (pending) {
    const target = targetOf(pending, sub);
    const from = payableFrom(pending, sub);
    change = {
      kind: pending.kind,
      targetPlan: target?.plan ?? null,
      targetExtra: target?.extraCollaborators ?? null,
      targetLabel: target
        ? planLabel(target.plan, target.extraCollaborators)
        : null,
      targetAmountLabel: target
        ? formatEuros(checkoutAmountCents(target.plan, target.extraCollaborators))
        : null,
      effectiveAtLabel: frDate(pending.effective_at),
      payableNow: isPayableNow(pending, sub),
      payableFromLabel: from ? frDate(from.toISOString()) : null,
    };
  }

  /* Droit de reprendre sans demande enregistrée. La règle est la même que
     celle de /api/portal/pay, et pour la même raison : un mensuel repris avant
     son terme repartirait du jour du paiement, donc perdrait les jours déjà
     réglés. On n'offre pas un bouton que la route refusera. */
  const periodRunning = isPeriodRunning(sub.current_period_end);
  const inArrears = sub.status === "past_due" || sub.status === "suspended";
  const resumePayable = Boolean(
    sub.recurrence_stopped_at &&
      (sub.plan === "ANNUAL" || !periodRunning || inArrears),
  );

  return (
    <SubscriptionSpace
      cabinetName={cabinetName}
      plan={sub.plan}
      extraCollaborators={sub.extra_collaborators}
      planLabelText={planLabel(sub.plan, sub.extra_collaborators)}
      renewalAmountLabel={formatEuros(sub.renewal_amount_cents)}
      status={sub.status}
      periodEndLabel={frDate(sub.current_period_end)}
      periodRunning={periodRunning}
      /* Distingue « la banque a refusé » de « la période s'est simplement
         terminée ». Sans ça, un contrat dont la reconduction était arrêtée
         affichait « Votre dernier paiement a été refusé » dès le lendemain de
         son échéance, alors qu'aucun paiement n'avait jamais été tenté. */
      paymentFailed={Boolean(sub.last_failure_at)}
      recurrenceStopped={Boolean(sub.recurrence_stopped_at)}
      graceUntilLabel={sub.grace_until ? frDate(sub.grace_until) : null}
      change={change}
      prices={priceTable()}
      monthlyEnabled={monthlyEnabled}
      annualEnabled={annualEnabled}
      checkoutOpen={open}
      resumePayable={resumePayable}
      invoices={invoices}
      billing={{
        adminName: sub.admin_name || session.cabinet.adminName,
        adminEmail: sub.admin_email || session.cabinet.adminEmail,
        address: sub.cabinet_address || session.cabinet.address,
        postalCity:
          sub.cabinet_postal_city ||
          `${session.cabinet.postalCode} ${session.cabinet.city}`.trim(),
        invoicePrefix: sub.invoice_prefix,
      }}
    />
  );
}
