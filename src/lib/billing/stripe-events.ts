import "server-only";
import type Stripe from "stripe";
import { serviceClient } from "@/lib/supabase/service";
import { alerteStripe } from "@/lib/billing/alerts";
import {
  applyInstalmentFailed,
  applyInstalmentPaid,
  instalmentFromInvoice,
} from "@/lib/billing/instalments";
import { finalizeOrderPayment } from "@/lib/billing/attach";
import {
  applyStripeSignupPayment,
  noteStripeSignupFailure,
} from "@/lib/billing/stripe-signup";
import { processDuePendingSignups } from "@/lib/billing/worker";
import { registerPaymentFailure } from "@/lib/billing/dunning";
import { notifyRenewal } from "@/lib/provisioning";
import { mirrorStripeInvoice } from "@/lib/stripe/invoices";
import { formatEuros } from "@/lib/checkout/pricing";
import { logAudit } from "@/lib/audit";
import { factsFromCompletedSession } from "@/lib/stripe/webhook";

/* ============================================================
   LES EFFETS D'UNE NOTIFICATION STRIPE, séparés de la route qui la reçoit.

   POURQUOI C'EST UN MODULE ET PLUS UNE FONCTION DE LA ROUTE. La route accuse
   TOUJOURS réception par un 200 dès que l'événement est en sécurité dans le
   journal, et l'unicité de `event_id` fait échouer toute re-livraison avant les
   effets. Autrement dit : Stripe ne rejoue jamais rien pour nous.

   Le code portait pourtant le commentaire inverse — « le contrat n'existe pas
   encore, Stripe re-livrera » — et c'était faux. Constaté le 05/08/2026 : trois
   `invoice.paid` et deux `checkout.session.completed` dormaient dans le journal,
   jamais appliqués, et AUCUNE facture Stripe n'avait été copiée dans notre
   registre. La facture du premier client n'apparaissait nulle part chez nous.

   C'est donc à NOUS de rejouer, depuis le journal qui existe précisément pour
   ça. D'où ce module, appelé par la route pour le premier passage et par le
   cron pour les reprises.
   ============================================================ */

/* `alerteStripe` a déménagé dans `@/lib/billing/alerts` : elle est désormais
   appelée des deux côtés du routage des versements, et la laisser ici créait un
   cycle d'imports. Réexportée pour ne pas casser les appelants existants. */
export { alerteStripe };

/** Une date telle qu'on l'écrit dans un email : « 17 août 2026 ». */
function frDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Applique les effets métier d'un événement déjà journalisé.
 *
 * Chaque branche marque `processed_at` elle-même, à la fin : ce qui distingue
 * « reçu » de « traité ». Un type qu'on ne traite pas reste donc visible comme
 * non traité, au lieu de se confondre avec un succès.
 */
export async function applyStripeEvent(
  event: Stripe.Event,
  eventId: string,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const marquerTraite = async () => {
    await supabase
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), process_error: null })
      .eq("event_id", eventId);
  };

  /* `async_payment_succeeded` accompagne `completed` pour les moyens de paiement
     différés : avec le prélèvement SEPA, la session se termine AVANT que l'argent
     n'arrive, et c'est ce second événement qui l'annonce. Le traiter comme le
     premier est exact — les deux portent la même session aboutie et payée — et
     l'omettre laisserait tout client payant par SEPA sans compte. */
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const faits = await factsFromCompletedSession(event);
    if (!faits.ok) {
      /* Pas une erreur : une session peut aboutir sans paiement acquis
         (prélèvement SEPA en cours). On le note sans alerter — le
         `async_payment_succeeded` viendra, ou le `async_payment_failed`. */
      await supabase
        .from("stripe_events")
        .update({ process_error: `ignoré : ${faits.reason}` })
        .eq("event_id", eventId);
      return;
    }

    /* Le tunnel de vente et l'espace abonnement n'écrivent pas dans la même
       table : un dossier d'inscription vit dans `pending_signups`, une commande
       dans `subscription_orders`. On essaie d'abord l'inscription, parce que
       `finalizeOrderPayment` ne trouverait rien et ne dirait rien. */
    const session = event.data.object as Stripe.Checkout.Session;
    const inscription = await applyStripeSignupPayment(supabase, {
      reference: faits.reference,
      amountCents: faits.amountCents,
      currency: faits.currency,
      occurredAt: faits.occurredAt,
      sessionId: session.id ?? null,
      stripe: faits.stripe,
    });

    if (inscription.kind === "not_a_signup") {
      await finalizeOrderPayment({
        reference: faits.reference,
        occurredAt: faits.occurredAt,
        amountCents: faits.amountCents,
        currency: faits.currency,
        /* Toujours faux ici : l'unicité de `event_id` a déjà écarté les
           re-livraisons avant qu'on arrive jusqu'à ces effets. */
        isReplay: false,
        stripe: faits.stripe,
      });
      await marquerTraite();
      return;
    }

    await marquerTraite();

    /* Provisioning hors du chemin d'acquittement : Stripe reçoit sa réponse
       tout de suite, le worker tourne après. Le claim est atomique côté base,
       donc un passage concurrent du cron ne peut pas doubler le travail. */
    if (inscription.kind === "paid") {
      try {
        await processDuePendingSignups(3);
      } catch (err) {
        /* Sans conséquence : le dossier est `paid` avec son heure de reprise
           échue, le cron le reprendra. */
        console.error(
          "[stripe-webhook] worker post-paiement :",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    return;
  }

  /* Un paiement différé refusé, ou une page de paiement abandonnée. Sans ces
     deux chemins, l'écran de suivi tourne indéfiniment sur « nous attendons la
     confirmation » pour un client dont le prélèvement a été rejeté. */
  if (
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const reference =
      session.client_reference_id ?? session.metadata?.reference ?? null;
    if (!reference) {
      await supabase
        .from("stripe_events")
        .update({ process_error: "ignoré : session sans référence" })
        .eq("event_id", eventId);
      return;
    }
    await noteStripeSignupFailure(supabase, {
      reference,
      reason:
        event.type === "checkout.session.expired" ? "expired" : "refused",
    });
    await marquerTraite();
    return;
  }

  /* UN ABONNEMENT QUI N'EXISTE PLUS CHEZ STRIPE.
     Deux causes : les relances d'impayé ont été épuisées, ou quelqu'un l'a
     supprimé depuis le tableau de bord Stripe. Dans les deux cas plus rien ne
     sera jamais prélevé.

     SANS CE CHEMIN, LE CABINET GARDE SON ACCÈS POUR TOUJOURS. Le cron
     d'expiration ne touche qu'aux contrats dont la reconduction est arrêtée
     (`expire_due_subscriptions` l'exige explicitement) : un contrat resté
     « actif » avec une reconduction qu'il croit vivante n'est jamais échu, et
     l'application continue d'ouvrir le logiciel à un cabinet qui ne paie plus.

     On ne coupe RIEN ici : on pose seulement la marque d'arrêt, et la mécanique
     existante applique la suite — période due jusqu'à son terme, puis quatorze
     jours de grâce, puis remontée EXPIRED à l'application. C'est l'engagement
     pris au client, et il ne dépend pas de la raison de l'arrêt. */
  if (event.type === "customer.subscription.deleted") {
    const abonnement = event.data.object as Stripe.Subscription;
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("id, cabinet_name, recurrence_stopped_at")
      .eq("stripe_subscription_id", abonnement.id)
      .maybeSingle();

    if (!subRow) {
      /* Aucun contrat : abonnement d'essai, ou supprimé avant que la
         souscription n'aboutisse. Rien à faire, et rien d'alarmant. */
      await supabase
        .from("stripe_events")
        .update({ process_error: `ignoré : aucun contrat pour ${abonnement.id}` })
        .eq("event_id", eventId);
      await marquerTraite();
      return;
    }

    const sub = subRow as {
      id: string;
      cabinet_name: string;
      recurrence_stopped_at: string | null;
    };

    /* Déjà marqué : c'est la fin normale d'une résiliation demandée par le
       praticien, elle a déjà été traitée et annoncée. */
    if (!sub.recurrence_stopped_at) {
      await supabase
        .from("subscriptions")
        .update({ recurrence_stopped_at: new Date(event.created * 1000).toISOString() })
        .eq("id", sub.id);

      /* Personne ne l'a demandé côté praticien : l'équipe doit le savoir, parce
         que c'est soit un impayé arrivé au bout, soit une manipulation dans le
         tableau de bord Stripe. Les deux méritent un regard humain. */
      await alerteStripe("Abonnement supprimé chez Stripe", [
        `Cabinet : ${sub.cabinet_name}`,
        `Abonnement Stripe : ${abonnement.id}`,
        `Motif Stripe : ${abonnement.cancellation_details?.reason ?? "(non précisé)"}`,
        "Aucune résiliation n'avait été demandée depuis l'espace abonnement. L'accès reste ouvert jusqu'au terme de la période réglée, puis quatorze jours de grâce, avant d'être fermé dans l'application.",
      ]);
    }

    await marquerTraite();
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    /* UN VERSEMENT DE L'OFFRE EN TROIS FOIS, ET RIEN D'AUTRE.
       Ce test vient EN PREMIER, et l'ordre n'est pas cosmétique.

       Ces factures sont volontairement détachées de l'abonnement Stripe : les y
       rattacher les ferait fusionner avec la facture annuelle. Elles n'ont donc
       aucun abonnement, et le test suivant les classerait « facture sans
       abonnement » puis les jetterait — les deux tiers du prix ne seraient
       jamais encaissés dans notre registre.

       Et si on les laissait passer pour des reconductions, ce serait pire :
       `applyStripeInvoicePaid` lit la fin de période sur la ligne de facture, or
       une ligne ponctuelle finit AUJOURD'HUI. Le praticien verrait son accès
       ramené à la date du jour au moment même où il paie. */
    const versement = instalmentFromInvoice(invoice);
    if (versement) {
      if (event.type === "invoice.paid") {
        await applyInstalmentPaid(supabase, invoice, versement);
      } else {
        await applyInstalmentFailed(supabase, invoice, versement);
      }
      await mirrorStripeInvoice(invoice, versement.subscriptionId);
      await marquerTraite();
      return;
    }

    const abonnement = subscriptionIdOf(invoice);
    if (!abonnement) {
      /* Une facture hors abonnement (ponctuelle, régularisation) ne concerne
         aucun contrat : on la note sans alerter. */
      await supabase
        .from("stripe_events")
        .update({ process_error: "ignoré : facture sans abonnement" })
        .eq("event_id", eventId);
      return;
    }

    /* On retrouve le contrat par l'abonnement Stripe, PAS par notre référence :
       les factures de reconduction ne la portent pas, seule la session
       d'origine l'avait. C'est la raison d'être de stripe_subscription_id. */
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("id, cabinet_name, app_cabinet_id, plan, currency, renewal_count, monetico_reference")
      .eq("stripe_subscription_id", abonnement)
      .maybeSingle();

    if (!subRow) {
      /* DEUX SITUATIONS TRÈS DIFFÉRENTES SE RESSEMBLENT ICI, et les confondre
         coûte cher.

         La bénigne : la facture de création arrive dans la même seconde que la
         session de paiement, donc avant que le contrat n'existe. Quelques
         minutes plus tard il est là. Il suffit d'attendre la reprise.

         LA GRAVE : l'abonnement Stripe est vivant et prélèvera tous les mois,
         mais la commande qui l'a ouvert est CLOSE chez nous — expirée faute
         d'être payée à temps, ou refusée. Plus rien ne créera le contrat, et le
         cabinet serait débité indéfiniment sans qu'aucun contrat n'existe en
         face. Constaté le 05/08/2026 sur MPKC2162DG43 : commande expirée,
         abonnement sub_1U17kP… toujours actif.

         On les distingue par l'état de la commande, que la facture nous donne
         par la référence rangée dans ses métadonnées. */
      const reference =
        (invoice as unknown as {
          parent?: { subscription_details?: { metadata?: Record<string, string> } };
        }).parent?.subscription_details?.metadata?.reference ?? null;

      if (reference) {
        const { data: orderRow } = await supabase
          .from("subscription_orders")
          .select("status, app_cabinet_id, billing_snapshot")
          .eq("monetico_reference", reference)
          .maybeSingle();
        const order = orderRow as {
          status: string;
          app_cabinet_id: string;
          billing_snapshot: { cabinetName?: string } | null;
        } | null;

        if (order && order.status !== "pending" && order.status !== "paid") {
          /* Rien ne viendra plus : la commande ne sera pas rouverte. Attendre
             une reprise qui n'aboutira jamais ne ferait que retarder l'alerte
             de dix heures pendant que les prélèvements courent. */
          await alerteStripe("URGENT — Abonnement Stripe sans contrat", [
            `Cabinet : ${order.billing_snapshot?.cabinetName ?? order.app_cabinet_id}`,
            `Référence : ${reference}`,
            `État de la commande : ${order.status}`,
            `Abonnement Stripe : ${abonnement}`,
            `Facture : ${invoice.number ?? invoice.id ?? "(inconnue)"}`,
            "L'abonnement est ACTIF chez Stripe et prélèvera à chaque échéance, alors qu'aucun contrat n'existe de notre côté. Soit annuler l'abonnement dans Stripe et rembourser, soit créer le contrat à la main.",
          ]);
          await supabase
            .from("stripe_events")
            .update({
              processed_at: new Date().toISOString(),
              process_error: `abonnement sans contrat (commande ${order.status}) — alerte émise`,
            })
            .eq("event_id", eventId);
          return;
        }
      }

      /* Cas bénin : la reprise du cron retrouvera le contrat. */
      await supabase
        .from("stripe_events")
        .update({
          process_error: `contrat introuvable pour ${abonnement} — sera repris`,
        })
        .eq("event_id", eventId);
      return;
    }

    const sub = subRow as {
      id: string;
      cabinet_name: string;
      app_cabinet_id: string;
      plan: "MONTHLY" | "ANNUAL";
      currency: string;
      renewal_count: number;
      monetico_reference: string;
    };

    if (event.type === "invoice.payment_failed") {
      /* NOTRE référence, pas le numéro de facture Stripe : la relance retrouve
         le contrat par elle, et c'est elle que porte `subscriptions`. Toute la
         mécanique d'impayé — délai de grâce de 14 jours, email au praticien,
         remontée PAST_DUE à l'application — fonctionne alors sans retouche. */
      await registerPaymentFailure({
        reference: sub.monetico_reference,
        occurredAt: new Date(event.created * 1000),
        codeRetour:
          invoice.last_finalization_error?.code ??
          `stripe:${invoice.status ?? "payment_failed"}`,
      });
      await marquerTraite();
      return;
    }

    await applyStripeInvoicePaid(supabase, invoice, sub, eventId);
    await marquerTraite();
    return;
  }

  /* UN ABONNEMENT MODIFIÉ. Nous sommes à l'origine de la quasi-totalité de ces
     événements : chaque changement de formule, chaque résiliation programmée et
     chaque paiement d'échéance en produit un, et notre registre est déjà à jour
     puisque c'est nous qui venons d'agir. Rien à faire, donc — mais il faut le
     DIRE, sinon la reprise le retenterait sept fois avant d'alerter pour rien.

     Ce qu'on perd à ne pas l'exploiter : une modification faite depuis le
     tableau de bord Stripe ne se répercuterait pas chez nous. C'est un geste
     d'exception, et `customer.subscription.deleted` couvre déjà le seul cas qui
     laisserait un cabinet payer — ou ne plus payer — sans qu'on le sache. */
  if (event.type === "customer.subscription.updated") {
    await supabase
      .from("stripe_events")
      .update({
        processed_at: new Date().toISOString(),
        process_error: "sans effet : notre registre est déjà à jour",
      })
      .eq("event_id", eventId);
    return;
  }

  /* UN REMBOURSEMENT.

     POURQUOI CE CHEMIN EXISTE. Un remboursement se décide chez Stripe, en deux
     clics, souvent par quelqu'un qui n'ouvrira jamais notre back-office. Sans
     ce chemin, l'argent repart et notre registre continue d'affirmer que la
     facture est payée : l'écriture comptable reste au crédit, aucun avoir
     n'existe, et le rapprochement est faux jusqu'à ce qu'un comptable le
     découvre des mois plus tard.

     CE QU'ON NE FAIT PAS : couper l'accès. Un remboursement peut être partiel,
     commercial, ou une régularisation d'erreur — fermer d'office le logiciel
     d'un praticien qui a peut-être encore droit à sa période serait brutal et
     souvent faux. On inscrit le fait, on prévient, et un humain décide. */
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    await applyStripeRefund(supabase, charge, event, eventId);
    await marquerTraite();
    return;
  }

  /* UNE CONTESTATION BANCAIRE. Le client a contesté auprès de sa banque.

     C'est l'événement le plus urgent de tout ce fichier : Stripe retient
     immédiatement le montant ET prélève des frais de dossier, et il y a un
     DÉLAI pour répondre avec des preuves — passé lequel la contestation est
     perdue d'office. Personne ne le découvrira en lisant des journaux : ça doit
     sonner. */
  if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.closed"
  ) {
    const litige = event.data.object as Stripe.Dispute;
    await noterLitige(supabase, litige, event.type);
    await marquerTraite();
    return;
  }

  /* Les autres types sont journalisés et attendent leur lot. `processed_at`
     reste NULL : un oubli se voit, il ne se confond pas avec un succès. */
}

/** Le contrat que porte un paiement, retrouvé par sa facture ou son abonnement. */
async function contratDuPaiement(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  invoiceId: string | null,
): Promise<{
  id: string;
  cabinet_name: string;
  currency: string;
  payment_environment: string | null;
} | null> {
  if (!invoiceId) return null;
  /* On passe par NOTRE miroir de facture : c'est lui qui porte le lien vers le
     contrat, et il a été écrit à l'encaissement. */
  const { data } = await supabase
    .from("invoices")
    .select("subscription_id")
    .eq("stripe_invoice_id", invoiceId)
    .maybeSingle();
  const subId = (data as { subscription_id: string | null } | null)?.subscription_id;
  if (!subId) return null;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, cabinet_name, currency, payment_environment")
    .eq("id", subId)
    .maybeSingle();
  return (sub as {
    id: string;
    cabinet_name: string;
    currency: string;
    payment_environment: string | null;
  } | null) ?? null;
}

/**
 * Inscrit un remboursement : écriture comptable négative, avoir au registre,
 * et alerte.
 *
 * Le montant vient de `amount_refunded`, qui est CUMULÉ : deux remboursements
 * partiels sur la même transaction produisent deux événements dont le second
 * porte le total. On enregistre donc la DIFFÉRENCE avec ce qu'on a déjà inscrit,
 * sans quoi un remboursement de 10 € puis de 5 € en compterait 25.
 */
async function applyStripeRefund(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  charge: Stripe.Charge,
  event: Stripe.Event,
  eventId: string,
): Promise<void> {
  /* `invoice` n'est plus déclaré sur le type Charge des versions récentes du
     SDK, alors que l'API le renvoie toujours. On le lit défensivement plutôt
     que de perdre le rattachement à la facture — c'est exactement le
     déménagement qui avait fait tomber les reconductions. */
  const invoiceId = idAbonnement(
    (charge as unknown as { invoice?: unknown }).invoice,
  );
  const contrat = await contratDuPaiement(supabase, invoiceId);
  const occurredAt = new Date(event.created * 1000);
  const cumul = charge.amount_refunded ?? 0;
  const devise = (charge.currency ?? "eur").toUpperCase();

  /* Ce qui a déjà été inscrit pour cette transaction. */
  const { data: dejaVu } = await supabase
    .from("billing_ledger")
    .select("amount_cents")
    .eq("event_type", "card_refund")
    .eq("reference", charge.id);
  const deja = (dejaVu ?? []).reduce(
    (t, l) => t + Math.abs((l as { amount_cents: number }).amount_cents),
    0,
  );
  const nouveau = cumul - deja;
  if (nouveau <= 0) {
    /* Rien de neuf : re-livraison, ou remboursement déjà inscrit. */
    await supabase
      .from("stripe_events")
      .update({ process_error: "remboursement déjà inscrit" })
      .eq("event_id", eventId);
    return;
  }

  /* Écriture NÉGATIVE : le journal est append-only, on n'efface pas une
     recette, on lui oppose une contrepartie. */
  await supabase.from("billing_ledger").insert({
    event_type: "card_refund",
    payment_provider: "stripe",
    payment_environment: contrat?.payment_environment ?? null,
    amount_cents: -nouveau,
    currency: devise,
    occurred_at: occurredAt.toISOString(),
    captured_at: occurredAt.toISOString(),
    reference: charge.id,
    subscription_id: contrat?.id ?? null,
    cabinet_name: contrat?.cabinet_name ?? "(cabinet inconnu)",
    meta: {
      provider: "stripe",
      stripe_invoice_id: invoiceId,
      total_rembourse_cents: cumul,
      integral: charge.refunded === true,
    },
  });

  await alerteStripe(
    charge.refunded ? "Remboursement TOTAL" : "Remboursement partiel",
    [
      `Cabinet : ${contrat?.cabinet_name ?? "(non retrouvé)"}`,
      `Montant remboursé à l'instant : ${formatEuros(nouveau)}`,
      `Total remboursé sur cette transaction : ${formatEuros(cumul)}`,
      `Transaction Stripe : ${charge.id}`,
      `Facture : ${invoiceId ?? "(hors facture)"}`,
      contrat
        ? "Une écriture négative a été inscrite au journal comptable. L'ACCÈS N'A PAS ÉTÉ COUPÉ : un remboursement peut être partiel ou commercial, et la décision de résilier appartient à un humain — elle se prend depuis la fiche de l'abonnement."
        : "AUCUN contrat retrouvé pour cette transaction : l'écriture est inscrite sans rattachement, à régulariser à la main.",
    ],
  );

  await logAudit({
    action: "billing.refunded",
    entityType: "subscription",
    entityId: contrat?.id ?? charge.id,
    diff: { provider: "stripe", amountCents: nouveau, total: cumul },
  });
}

/**
 * Une contestation bancaire.
 *
 * On n'écrit RIEN au journal comptable : tant que le litige n'est pas tranché,
 * l'argent n'est ni perdu ni acquis, et l'inscrire fausserait le rapprochement
 * dans un sens comme dans l'autre. Ce qui compte ici, c'est que quelqu'un soit
 * prévenu à temps.
 */
async function noterLitige(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  litige: Stripe.Dispute,
  type: string,
): Promise<void> {
  const chargeId =
    typeof litige.charge === "string" ? litige.charge : (litige.charge?.id ?? null);
  let cabinet = "(non retrouvé)";
  if (chargeId) {
    const { data } = await supabase
      .from("billing_ledger")
      .select("cabinet_name")
      .eq("reference", chargeId)
      .limit(1)
      .maybeSingle();
    cabinet = (data as { cabinet_name: string } | null)?.cabinet_name ?? cabinet;
  }

  const ouvert = type === "charge.dispute.created";
  const echeance = litige.evidence_details?.due_by
    ? frDate(new Date(litige.evidence_details.due_by * 1000))
    : null;

  await alerteStripe(
    ouvert
      ? "URGENT — Contestation bancaire ouverte"
      : `Contestation bancaire close (${litige.status})`,
    [
      `Cabinet : ${cabinet}`,
      `Montant : ${formatEuros(litige.amount ?? 0)}`,
      `Motif : ${litige.reason ?? "(non précisé)"}`,
      `État : ${litige.status}`,
      `Litige Stripe : ${litige.id}`,
      ...(ouvert
        ? [
            echeance
              ? `RÉPONDRE AVANT LE ${echeance.toUpperCase()} — passé ce délai, la contestation est perdue d'office.`
              : "Répondre au plus vite : passé le délai fixé par la banque, la contestation est perdue d'office.",
            "Stripe a déjà retenu le montant et prélevé des frais de dossier. Les preuves se déposent depuis le tableau de bord Stripe : facture, preuve de service rendu, échanges avec le cabinet.",
          ]
        : ["Aucune action requise : le dossier est clos."]),
    ],
  );
}

/** Un identifiant d'abonnement, qu'il soit donné en clair ou développé. */
function idAbonnement(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && "id" in v) {
    const id = (v as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

/**
 * L'abonnement porté par une facture, quelle que soit la forme de l'API.
 *
 * CE DÉTAIL A FAIT TOMBER TOUTE LA FACTURATION STRIPE, et silencieusement.
 * Les versions récentes de l'API ont RETIRÉ `invoice.subscription` et
 * `line.subscription` : l'abonnement vit maintenant sous `parent`. Le code ne
 * regardait que les anciens emplacements, concluait « facture sans abonnement »,
 * et s'arrêtait là.
 *
 * Vérifié le 05/08/2026 sur la facture réelle in_1U18ZB… : `subscription` est
 * absent des deux niveaux, et l'abonnement n'existe que dans
 * `parent.subscription_details.subscription`.
 *
 * Ce que ça coûtait, au-delà de la facture non copiée : AUCUNE reconduction
 * n'aurait prolongé la période. Le praticien aurait été prélevé tous les mois
 * par Stripe pendant que son abonnement expirait chez nous, et il aurait perdu
 * l'accès à son logiciel en ayant payé. Aucun impayé n'aurait été relancé non
 * plus, pour la même raison.
 *
 * On lit donc les quatre emplacements, du plus récent au plus ancien.
 */
export function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
  };

  /* Forme actuelle : sur la facture, sous `parent`. */
  const parParent = idAbonnement(inv.parent?.subscription_details?.subscription);
  if (parParent) return parParent;

  /* Forme historique, conservée tant que des points de terminaison plus anciens
     peuvent nous livrer des événements. */
  const direct = idAbonnement(inv.subscription);
  if (direct) return direct;

  for (const line of invoice.lines?.data ?? []) {
    const l = line as unknown as {
      subscription?: unknown;
      parent?: { subscription_item_details?: { subscription?: unknown } };
    };
    const parLigne =
      idAbonnement(l.parent?.subscription_item_details?.subscription) ??
      idAbonnement(l.subscription);
    if (parLigne) return parLigne;
  }
  return null;
}

/**
 * Une échéance encaissée : registre, période, et remontée à l'application.
 *
 * La période N'EST PAS calculée : elle est lue sur la facture, dont la ligne
 * porte la fin de période que Stripe applique réellement. C'est la même règle
 * qu'à la souscription — recalculer ferait dériver notre date de la sienne, et
 * c'est la nôtre que le praticien lirait.
 */
async function applyStripeInvoicePaid(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  invoice: Stripe.Invoice,
  sub: {
    id: string;
    cabinet_name: string;
    app_cabinet_id: string;
    plan: "MONTHLY" | "ANNUAL";
    currency: string;
    renewal_count: number;
    monetico_reference: string;
  },
  eventId: string,
): Promise<void> {
  const paidCents = invoice.amount_paid ?? invoice.total ?? 0;
  const currency = (invoice.currency ?? sub.currency).toUpperCase();
  const occurredAt = new Date((invoice.created ?? Date.now() / 1000) * 1000);
  const premiere = invoice.billing_reason === "subscription_create";

  /* Le miroir d'abord : c'est lui qui remplace notre émission, et il est
     idempotent par l'identifiant de facture Stripe. */
  const miroir = await mirrorStripeInvoice(invoice, sub.id);
  if (!miroir.ok) {
    console.error("[stripe-webhook] miroir de facture :", miroir.reason);
  }

  /* La toute première facture est déjà comptabilisée par la finalisation de la
     session : la recompter doublerait l'écriture et le chiffre d'affaires. */
  if (premiere) return;

  const finDePeriode = periodEndOf(invoice);

  const { error: ledgerError } = await supabase.from("billing_ledger").insert({
    event_type: "card_renewal",
    payment_provider: "stripe",
    payment_environment: invoice.livemode ? "production" : "test",
    amount_cents: paidCents,
    currency,
    occurred_at: occurredAt.toISOString(),
    /* Stripe a prélevé : l'écriture naît encaissée, il n'y a rien à recouvrer. */
    captured_at: occurredAt.toISOString(),
    stripe_invoice_id: invoice.id ?? null,
    reference: invoice.number ?? invoice.id ?? eventId,
    subscription_id: sub.id,
    cabinet_name: sub.cabinet_name,
    meta: { kind: "stripe_renewal" },
  });
  if (ledgerError && ledgerError.code !== "23505") {
    throw new Error(`journal comptable : ${ledgerError.message}`);
  }

  if (finDePeriode) {
    await supabase
      .from("subscriptions")
      .update({
        current_period_end: finDePeriode.toISOString(),
        status: "active",
        renewal_count: sub.renewal_count + 1,
        last_renewal_at: occurredAt.toISOString(),
        /* Une échéance encaissée solde tout incident antérieur. */
        dunning_started_at: null,
        dunning_failure_count: 0,
        grace_until: null,
        last_failure_code: null,
      })
      .eq("id", sub.id);
  }

  const sync = await notifyRenewal({
    idempotencyKey: `stripe-${invoice.id ?? eventId}`,
    cabinetId: sub.app_cabinet_id,
    plan: sub.plan,
    periodEnd: finDePeriode?.toISOString(),
    paidAt: occurredAt.toISOString(),
    amountCents: paidCents,
    currency,
    status: "ACTIVE",
  });
  if (!sync.ok) {
    /* Une échéance encaissée mais non remontée laisse le logiciel du praticien
       sur l'ancienne date : il verra son abonnement expirer alors qu'il vient de
       payer. L'encaissement est bon, seule la date affichée est à reposer — mais
       personne ne le saura si ça ne sort que dans les journaux. */
    await alerteStripe("Échéance non remontée à l'application", [
      `Cabinet : ${sub.cabinet_name}`,
      `Cabinet applicatif : ${sub.app_cabinet_id}`,
      `Facture Stripe : ${invoice.number ?? invoice.id ?? "(inconnue)"}`,
      `Nouvelle échéance : ${finDePeriode ? frDate(finDePeriode) : "(inchangée)"}`,
      `Erreur : ${sync.reason}`,
      "L'encaissement, le contrat et la facture sont faits ; seule la date affichée dans l'application reste à poser à la main.",
    ]);
  }
}

/** La fin de période appliquée par Stripe, lue sur la ligne de facture. */
function periodEndOf(invoice: Stripe.Invoice): Date | null {
  for (const line of invoice.lines?.data ?? []) {
    const fin = line.period?.end;
    if (typeof fin === "number") return new Date(fin * 1000);
  }
  return null;
}
