import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { notifyRenewal } from "@/lib/provisioning";
import { alerteStripe } from "@/lib/billing/alerts";
import { formatEuros, INSTALMENT_COUNT } from "@/lib/checkout/pricing";

/* ============================================================
   LES VERSEMENTS DE L'OFFRE 12 MOIS EN TROIS FOIS.

   Le praticien règle un tiers à la signature, puis un tiers à chacun des deux
   mois suivants. Son accès court sur douze mois dès le premier versement.

   TROIS CHOSES SONT VRAIES EN MÊME TEMPS, et c'est ce qui rend ce fichier
   nécessaire :

     1. Stripe ne connaît pas nos versements. Le premier est encaissé comme un
        achat simple, puis l'abonnement des douze mois est ouvert par nous,
        ancré à un an et sans prorata : il ne prélèvera rien avant le douzième
        mois. Les deux versements du milieu n'existent donc que parce que NOUS
        les émettons.

     2. Une facture de versement n'est PAS une reconduction. Elle ne prolonge
        rien : la période est déjà acquise jusqu'au douzième mois. La confondre
        avec une échéance d'abonnement ramènerait la fin de période à la date du
        jour — le praticien verrait son accès s'effondrer en ayant payé.

     3. Un versement refusé ferme l'accès EN ÉCRITURE, tout de suite. C'est le
        choix explicite du client, le 06/08/2026 : « ça oblige à agir vite ».
        Pas de délai de grâce, contrairement à un impayé de reconduction.
        Le praticien garde la lecture et l'export de ses dossiers — c'est une
        obligation, pas une faveur : ce sont des données de santé qui sont les
        siennes, et le dossier de ses patients doit rester consultable.
   ============================================================ */

/** Marque posée sur les factures que nous émettons nous-mêmes. */
const META_SUBSCRIPTION = "medicarepro_instalment_subscription";
const META_INDEX = "medicarepro_instalment_index";
const META_TOTAL = "medicarepro_instalment_total";

export type InstalmentRef = {
  /** Notre identifiant de contrat, pas celui de Stripe. */
  subscriptionId: string;
  /** Rang du versement, à partir de 1. */
  index: number;
  total: number;
};

/**
 * Reconnaît une facture de versement.
 *
 * DOIT ÊTRE INTERROGÉ AVANT toute logique de reconduction : ces factures sont
 * volontairement détachées de l'abonnement Stripe (sinon Stripe les fusionnerait
 * avec la facture annuelle), donc `subscriptionIdOf` ne les rattache à rien et
 * elles seraient classées « facture sans abonnement » puis ignorées.
 */
export function instalmentFromInvoice(invoice: Stripe.Invoice): InstalmentRef | null {
  const m = invoice.metadata ?? {};
  const subscriptionId = m[META_SUBSCRIPTION];
  const index = Number.parseInt(m[META_INDEX] ?? "", 10);
  const total = Number.parseInt(m[META_TOTAL] ?? "", 10);
  if (!subscriptionId || !Number.isInteger(index) || index < 1) return null;
  return {
    subscriptionId,
    index,
    total: Number.isInteger(total) && total > 0 ? total : INSTALMENT_COUNT,
  };
}

/**
 * Douze mois plus tard, sans déborder sur le mois suivant.
 *
 * Le 31 août + 12 mois donnerait le 3 septembre en arithmétique naïve : on
 * ramène au dernier jour du mois visé.
 */
export function douzeMoisApres(date: Date): Date {
  const d = new Date(date.getTime());
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 12);
  if (d.getUTCDate() < jour) d.setUTCDate(0);
  return d;
}

/**
 * Ouvre l'abonnement des douze mois APRÈS l'encaissement du premier versement.
 *
 * POURQUOI CE N'EST PAS CHECKOUT QUI LE CRÉE. Une session d'abonnement, dès
 * qu'on y ajoute une ligne ponctuelle, refuse `proration_behavior: none` — et
 * sans lui, ancrer le cycle à douze mois fait facturer l'année entière PAR
 * DESSUS le versement : 397,41 € au lieu de 99,36 €. Le seul contournement
 * possible dans Checkout était une période d'essai, qui imprimait une ligne
 * « Essai gratuit » sur une facture pourtant payée. L'API directe, elle,
 * accepte l'ancrage sans prorata : l'abonnement naît ACTIF, sans essai, sans
 * facture et sans prélèvement. Les trois montages ont été mesurés chez Stripe
 * le 06/08/2026 ; c'est le seul qui soit à la fois juste et lisible.
 *
 * IDEMPOTENT SUR NOTRE RÉFÉRENCE : un événement rejoué ne peut pas ouvrir un
 * second abonnement, donc pas non plus prélever deux fois dans douze mois.
 */
export async function openAnchoredAnnualSubscription(input: {
  reference: string;
  customerId: string;
  /** Carte enregistrée pendant le paiement, à débiter aux échéances suivantes. */
  paymentMethodId?: string;
  plan: "MONTHLY" | "ANNUAL";
  extraCollaborators: number;
  /** Point de départ des douze mois : l'instant du paiement. */
  paidAt: Date;
  metadata?: Record<string, string>;
}): Promise<{ subscriptionId: string; currentPeriodEnd: Date }> {
  const { prices, taxRate } = stripeConfig();
  if (!taxRate) {
    throw new Error("Aucun taux de TVA Stripe configuré : abonnement non ouvert.");
  }
  if (input.plan !== "ANNUAL") {
    throw new Error("L'échelonnement n'existe que sur l'offre 12 mois.");
  }
  if (!prices.annual) {
    throw new Error("Aucun prix annuel Stripe configuré.");
  }
  if (input.extraCollaborators > 0 && !prices.collaboratorAnnual) {
    throw new Error(
      "Prix collaborateur annuel absent : abonnement refusé plutôt que sous-facturé.",
    );
  }

  const items: Array<{ price: string; quantity: number }> = [
    { price: prices.annual, quantity: 1 },
  ];
  if (input.extraCollaborators > 0 && prices.collaboratorAnnual) {
    items.push({
      price: prices.collaboratorAnnual,
      quantity: input.extraCollaborators,
    });
  }

  const echeance = douzeMoisApres(input.paidAt);
  const abonnement = await stripe().subscriptions.create(
    {
      customer: input.customerId,
      items,
      /* La première facturation tombe dans douze mois : les douze premiers mois
         sont couverts par les versements, que Stripe ne connaît pas. */
      billing_cycle_anchor: Math.floor(echeance.getTime() / 1000),
      /* SANS CETTE LIGNE, Stripe facture immédiatement les douze mois au
         prorata, en plus du versement déjà encaissé. C'est le paramètre qui
         fait toute la différence entre 99,36 € et 397,41 €. */
      proration_behavior: "none",
      default_tax_rates: [taxRate],
      ...(input.paymentMethodId
        ? { default_payment_method: input.paymentMethodId }
        : {}),
      description: `Abonnement MediCare Pro : offre 12 mois${
        input.extraCollaborators > 0
          ? ` + ${input.extraCollaborators} collaborateur${input.extraCollaborators > 1 ? "s" : ""}`
          : ""
      } (réglée en versements)`,
      metadata: { ...input.metadata, reference: input.reference },
    },
    { idempotencyKey: `abonnement-echelonne:${input.reference}` },
  );

  const fin =
    (abonnement as unknown as { current_period_end?: number }).current_period_end ??
    abonnement.items?.data?.[0]?.current_period_end;
  return {
    subscriptionId: abonnement.id,
    currentPeriodEnd: typeof fin === "number" ? new Date(fin * 1000) : echeance,
  };
}

/** « 2ᵉ versement sur 3 » — le libellé que le praticien lit sur sa facture. */
export function instalmentLabel(index: number, total: number): string {
  const rang = index === 1 ? "1er" : `${index}e`;
  return `Offre 12 mois MediCare Pro : ${rang} versement sur ${total}`;
}

/* ------------------------------------------------------------
   ÉMISSION DES VERSEMENTS DUS — appelé par le cron.
   ------------------------------------------------------------ */

export type InstalmentRunResult = {
  claimed: number;
  charged: number;
  failed: number;
  details: string[];
};

/**
 * Émet les versements échus et les prélève immédiatement.
 *
 * La réservation est atomique côté base (`claim_due_instalments`) : deux
 * passages concurrents du cron ne peuvent pas facturer deux fois le même
 * versement. Chaque échec est isolé — un contrat qui casse n'empêche pas les
 * autres d'être prélevés.
 */
export async function emitDueInstalments(limit = 20): Promise<InstalmentRunResult> {
  const supabase = serviceClient();
  const out: InstalmentRunResult = { claimed: 0, charged: 0, failed: 0, details: [] };
  if (!supabase) return out;

  const { data, error } = await supabase.rpc("claim_due_instalments", {
    p_limit: limit,
  });
  if (error) throw new Error(`réservation des versements : ${error.message}`);

  const dus = (data ?? []) as Array<{
    subscription_id: string;
    stripe_subscription_id: string;
    app_cabinet_id: string;
    cabinet_name: string;
    payment_reference: string;
    instalment_index: number;
    amount_cents: number;
    currency: string;
  }>;
  out.claimed = dus.length;

  for (const du of dus) {
    try {
      await emitOneInstalment(supabase, du);
      out.charged += 1;
      out.details.push(
        `${du.cabinet_name} : versement ${du.instalment_index} émis (${formatEuros(du.amount_cents)})`,
      );
    } catch (err) {
      out.failed += 1;
      const raison = err instanceof Error ? err.message : String(err);
      out.details.push(`${du.cabinet_name} : ÉCHEC — ${raison}`);
      await supabase
        .from("subscriptions")
        .update({ instalment_last_error: raison.slice(0, 300) })
        .eq("id", du.subscription_id);
      /* L'émission a échoué pour une raison technique (moyen de paiement
         disparu, abonnement supprimé). Ce n'est pas un refus bancaire : le
         praticien n'y est pour rien, donc on n'ouvre pas la lecture seule, on
         alerte. La réservation a déjà repoussé l'échéance d'une heure. */
      await alerteStripe("Versement non émis", [
        `Cabinet : ${du.cabinet_name}`,
        `Référence : ${du.payment_reference}`,
        `Versement ${du.instalment_index} sur ${INSTALMENT_COUNT} — ${formatEuros(du.amount_cents)}`,
        `Erreur : ${raison}`,
        "Nouvelle tentative dans une heure. Si l'erreur persiste, le versement doit être réclamé à la main dans Stripe.",
      ]);
    }
  }

  return out;
}

async function emitOneInstalment(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  du: {
    subscription_id: string;
    stripe_subscription_id: string;
    cabinet_name: string;
    payment_reference: string;
    instalment_index: number;
    amount_cents: number;
    currency: string;
  },
): Promise<void> {
  if (du.amount_cents <= 0) {
    throw new Error("montant du versement introuvable dans le calendrier");
  }
  const { taxRate } = stripeConfig();
  if (!taxRate) {
    throw new Error("aucun taux de TVA configuré : versement non émis plutôt que facturé sans TVA");
  }

  const s = stripe();

  /* Le client ET le moyen de paiement viennent de l'abonnement, pas de nos
     archives : c'est lui qui porte la carte que le praticien a saisie, et c'est
     elle qu'il s'attend à voir débitée. Le moyen par défaut du CLIENT peut être
     un autre, ou aucun. */
  const abonnement = await s.subscriptions.retrieve(du.stripe_subscription_id);
  if (abonnement.status === "canceled") {
    throw new Error("abonnement supprimé chez Stripe");
  }
  const customerId =
    typeof abonnement.customer === "string"
      ? abonnement.customer
      : abonnement.customer.id;
  const moyen =
    typeof abonnement.default_payment_method === "string"
      ? abonnement.default_payment_method
      : (abonnement.default_payment_method?.id ?? undefined);

  const metadata: Record<string, string> = {
    [META_SUBSCRIPTION]: du.subscription_id,
    [META_INDEX]: String(du.instalment_index),
    [META_TOTAL]: String(INSTALMENT_COUNT),
    reference: du.payment_reference,
  };
  /* Idempotence sur le CONTRAT et le RANG : si l'émission a réussi chez Stripe
     mais que notre réponse s'est perdue, la reprise retombe sur la même facture
     au lieu d'en créer une seconde. C'est le seul garde-fou entre une reprise
     réseau et un praticien débité deux fois. */
  const cle = `versement:${du.subscription_id}:${du.instalment_index}`;

  const facture = await s.invoices.create(
    {
      customer: customerId,
      collection_method: "charge_automatically",
      /* On finalise et on prélève nous-mêmes, juste en dessous : laisser Stripe
         avancer tout seul retarderait l'encaissement d'environ une heure. */
      auto_advance: false,
      ...(moyen ? { default_payment_method: moyen } : {}),
      description: instalmentLabel(du.instalment_index, INSTALMENT_COUNT),
      metadata,
      currency: du.currency.toLowerCase(),
    },
    { idempotencyKey: `${cle}:facture` },
  );
  if (!facture.id) throw new Error("Stripe n'a pas renvoyé de facture");

  await s.invoiceItems.create(
    {
      customer: customerId,
      invoice: facture.id,
      amount: du.amount_cents,
      currency: du.currency.toLowerCase(),
      description: instalmentLabel(du.instalment_index, INSTALMENT_COUNT),
      tax_rates: [taxRate],
      metadata,
    },
    { idempotencyKey: `${cle}:ligne` },
  );

  await s.invoices.finalizeInvoice(facture.id);

  /* Le refus bancaire n'est PAS une erreur de notre côté : Stripe émet
     `invoice.payment_failed`, et c'est ce chemin-là qui pose la lecture seule.
     Le laisser remonter ici ferait alerter deux fois et compterait le versement
     comme « non émis » alors qu'il l'a bien été. */
  try {
    await s.invoices.pay(facture.id);
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (!/card|declin|insufficient|payment|refus/i.test(m)) throw err;
  }
}

/* ------------------------------------------------------------
   RETOUR DES ÉVÉNEMENTS STRIPE.
   ------------------------------------------------------------ */

type SubRow = {
  id: string;
  cabinet_name: string;
  app_cabinet_id: string;
  plan: "MONTHLY" | "ANNUAL";
  currency: string;
  monetico_reference: string;
  current_period_end: string;
  instalment_paid_count: number;
  instalment_total_count: number;
  instalment_suspended_at: string | null;
};

const CHAMPS =
  "id, cabinet_name, app_cabinet_id, plan, currency, monetico_reference, current_period_end, instalment_paid_count, instalment_total_count, instalment_suspended_at";

/**
 * Un versement encaissé.
 *
 * NE TOUCHE PAS À `current_period_end`. C'est la différence de fond avec une
 * reconduction : la période a été acquise en entier au premier versement, et la
 * date de fin lue sur cette facture ponctuelle vaut aujourd'hui. L'écrire
 * fermerait l'accès d'un praticien qui vient de payer.
 */
export async function applyInstalmentPaid(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  invoice: Stripe.Invoice,
  ref: InstalmentRef,
): Promise<void> {
  const { data } = await supabase
    .from("subscriptions")
    .select(CHAMPS)
    .eq("id", ref.subscriptionId)
    .maybeSingle();
  if (!data) {
    await alerteStripe("Versement encaissé sans contrat", [
      `Contrat annoncé : ${ref.subscriptionId}`,
      `Facture : ${invoice.number ?? invoice.id ?? "(inconnue)"}`,
      "L'argent est encaissé chez Stripe mais aucun contrat ne lui correspond. À rapprocher à la main.",
    ]);
    return;
  }
  const sub = data as SubRow;

  const paidCents = invoice.amount_paid ?? invoice.total ?? 0;
  const currency = (invoice.currency ?? sub.currency).toUpperCase();
  const occurredAt = new Date((invoice.created ?? Date.now() / 1000) * 1000);

  /* Le miroir de facture et l'écriture comptable sont posés par le chemin
     commun ; ici on ne fait que l'avancement du calendrier et la réouverture. */
  const { error: ledgerError } = await supabase.from("billing_ledger").insert({
    event_type: "card_renewal",
    payment_provider: "stripe",
    payment_environment: invoice.livemode ? "production" : "test",
    amount_cents: paidCents,
    currency,
    occurred_at: occurredAt.toISOString(),
    captured_at: occurredAt.toISOString(),
    stripe_invoice_id: invoice.id ?? null,
    reference: invoice.number ?? invoice.id ?? `versement-${ref.index}`,
    subscription_id: sub.id,
    cabinet_name: sub.cabinet_name,
    meta: { kind: "stripe_instalment", instalment: ref.index, of: ref.total },
  });
  if (ledgerError && ledgerError.code !== "23505") {
    throw new Error(`journal comptable : ${ledgerError.message}`);
  }

  /* Le rang porté par la facture fait foi, pas un incrément : si un événement
     est rejoué, le compteur retombe sur la même valeur au lieu de dériver. */
  const regles = Math.max(sub.instalment_paid_count, ref.index);
  const reste = regles < sub.instalment_total_count;

  await supabase
    .from("subscriptions")
    .update({
      instalment_paid_count: regles,
      /* Le versement suivant tombe un mois après celui-ci. On compte depuis la
         date de la facture et non depuis « maintenant » : une reprise tardive
         ne doit pas décaler tout le calendrier. */
      next_instalment_at: reste ? unMoisApres(occurredAt).toISOString() : null,
      instalment_suspended_at: null,
      instalment_last_error: null,
      status: "active",
    })
    .eq("id", sub.id);

  /* RÉOUVERTURE. Un praticien passé en lecture seule doit retrouver l'écriture
     à la seconde où il paie. Sans cette remontée, il resterait bloqué avec un
     compte à jour — et c'est le premier appel qu'on recevrait. */
  const sync = await notifyRenewal({
    idempotencyKey: `versement-${sub.id}-${ref.index}`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    status: "ACTIVE",
    periodEnd: sub.current_period_end,
    paidAt: occurredAt.toISOString(),
    amountCents: paidCents,
    currency,
  });

  if (!sync.ok && sub.instalment_suspended_at) {
    await alerteStripe("URGENT — Versement payé, accès toujours bloqué", [
      `Cabinet : ${sub.cabinet_name}`,
      `Cabinet applicatif : ${sub.app_cabinet_id}`,
      `Versement ${ref.index} sur ${ref.total} encaissé : ${formatEuros(paidCents)}`,
      `Erreur de remontée : ${sync.reason}`,
      "Le praticien a payé mais son logiciel refuse encore l'écriture. À rétablir à la main, en priorité.",
    ]);
  }
}

/**
 * Un versement refusé — l'accès passe en lecture seule IMMÉDIATEMENT.
 *
 * Pas de délai de grâce, à la différence d'un impayé de reconduction qui en
 * accorde quatorze. C'est une décision assumée du client : le praticien a déjà
 * douze mois d'accès ouverts devant lui, et seule la fermeture immédiate le
 * fait réagir avant que les deux tiers du prix ne deviennent irrécouvrables.
 */
export async function applyInstalmentFailed(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  invoice: Stripe.Invoice,
  ref: InstalmentRef,
): Promise<void> {
  const { data } = await supabase
    .from("subscriptions")
    .select(CHAMPS)
    .eq("id", ref.subscriptionId)
    .maybeSingle();
  if (!data) return;
  const sub = data as SubRow;

  const maintenant = new Date().toISOString();
  const motif =
    invoice.last_finalization_error?.code ??
    `stripe:${invoice.status ?? "payment_failed"}`;

  await supabase
    .from("subscriptions")
    .update({
      instalment_suspended_at: sub.instalment_suspended_at ?? maintenant,
      instalment_last_error: motif,
      last_failure_code: motif,
    })
    .eq("id", sub.id);

  const sync = await notifyRenewal({
    idempotencyKey: `versement-refuse-${sub.id}-${ref.index}`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    status: "SUSPENDED",
    /* La période reste celle qui a été ouverte : on ne raccourcit pas un droit
       déjà acquis, on suspend seulement l'écriture le temps du règlement. */
    periodEnd: sub.current_period_end,
  });

  await alerteStripe("Versement refusé — accès passé en lecture seule", [
    `Cabinet : ${sub.cabinet_name}`,
    `Référence : ${sub.monetico_reference}`,
    `Versement ${ref.index} sur ${ref.total}`,
    `Motif : ${motif}`,
    sync.ok
      ? "L'application a été prévenue : le cabinet peut lire et exporter, mais plus rien enregistrer, jusqu'au règlement."
      : `⚠️ L'application n'a PAS reçu la suspension (${sync.reason}) : le cabinet écrit encore. À poser à la main.`,
    "Stripe représentera automatiquement le paiement selon ses règles de relance ; l'accès se rouvrira seul au premier encaissement.",
  ]);
}

/**
 * Un mois plus tard, sans déborder sur le mois suivant.
 *
 * Le 31 janvier + un mois donne le 3 mars en arithmétique naïve. Un praticien
 * qui signe un 31 verrait son versement sauter un mois entier.
 */
export function unMoisApres(date: Date): Date {
  const d = new Date(date.getTime());
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() < jour) d.setUTCDate(0);
  return d;
}
