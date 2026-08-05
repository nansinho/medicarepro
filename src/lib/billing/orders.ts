import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { buildPaymentForm, type SealedPaymentForm } from "@/lib/monetico";
import { moneticoConfigForPlan } from "@/lib/billing/monetico-routing";
import type { BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   Commandes bancaires d'un abonnement (subscription_orders, 0028).

   POURQUOI CETTE COUCHE : Monetico n'offre AUCUN moyen de modifier une
   commande récurrente en place — pas d'alias, pas d'empreinte carte, pas de
   changement de montant. Changer de carte, ajouter un collaborateur ou passer
   à l'annuel impose donc d'arrêter la commande et d'en ouvrir une nouvelle,
   avec une nouvelle référence. Or toute la chaîne d'encaissement (capture,
   arrêt de récurrence, facturation) retrouvait ses paramètres par
   `subscriptions.monetico_reference`, unique et figée à vie.

   Ici, la référence appartient à la COMMANDE, et l'abonnement pointe vers la
   commande récurrente actuellement vivante. Tout code qui a besoin de la date
   de commande ou du montant d'origine passe par `orderContext()`.

   Rien n'est écrit ailleurs que par service-role (RLS sans policy).
   ============================================================ */

export type OrderKind =
  | "initial"
  | "attach"
  | "resubscribe"
  | "card_update"
  | "plan_change";

export type OrderRole = "recurring" | "oneshot";

export type OrderStatus =
  | "pending"
  | "paid"
  | "applied"
  | "amount_mismatch"
  | "expired"
  | "failed";

/** Durée de vie d'une commande ouverte mais jamais payée. */
export const ORDER_TTL_MINUTES = 60;

/* ------------------------------------------------------------
   Référence Monetico.
   ------------------------------------------------------------ */

/* Alphabet Crockford : ni I, ni L, ni O, ni U — une référence se relit et se
   dicte au téléphone sans ambiguïté. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Référence brute de 12 caractères (préfixe MP + 10 tirages). */
function randomReference(): string {
  const bytes = randomBytes(10);
  let out = "MP";
  for (let i = 0; i < 10; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

/**
 * Référence libre de collision, vérifiée contre les TROIS espaces de noms qui
 * partagent la contrainte d'unicité (dossiers de checkout, renouvellements
 * annuels, commandes). Les générateurs historiques ne vérifiaient rien : sur
 * collision, l'INSERT échouait en 502 sans nouvelle tentative.
 */
export async function newOrderReference(
  supabase: SupabaseClient,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const reference = randomReference();
    const [orders, signups, renewals] = await Promise.all([
      supabase
        .from("subscription_orders")
        .select("id")
        .eq("monetico_reference", reference)
        .maybeSingle(),
      supabase
        .from("pending_signups")
        .select("id")
        .eq("monetico_reference", reference)
        .maybeSingle(),
      supabase
        .from("subscription_renewals")
        .select("id")
        .eq("monetico_reference", reference)
        .maybeSingle(),
    ]);
    if (!orders.data && !signups.data && !renewals.data) return reference;
  }
  throw new Error("Impossible de tirer une référence Monetico libre.");
}

/* ------------------------------------------------------------
   Résolution : « à quoi correspond cette référence ? »
   ------------------------------------------------------------ */

export type OrderContext = {
  /** null si la référence ne vient pas de subscription_orders (repli legacy). */
  orderId: string | null;
  subscriptionId: string | null;
  reference: string;
  /** Date de commande JJ/MM/AAAA, telle qu'envoyée à la banque. */
  orderDate: string | null;
  /** Repli si la date de commande manque (ancien dossier). */
  fallbackDateIso: string;
  plan: BillingPlan;
  /** Montant de la COMMANDE — c'est lui que la banque authentifie, pas celui
      de l'échéance en cours. */
  amountCents: number;
  role: OrderRole;
  kind: OrderKind | null;
  /**
   * Plateforme Monetico où vit RÉELLEMENT cette commande.
   *
   * NULL veut dire « inconnue », pas « courante » : l'appelant doit alors
   * interroger la banque quand même. Se tromper dans ce sens ne coûte qu'un
   * refus ; se tromper dans l'autre ferait sauter l'appel et laisserait un
   * client résilié se faire prélever.
   */
  platform: "test" | "production" | null;
};

type OrderRow = {
  id: string;
  subscription_id: string | null;
  monetico_reference: string;
  monetico_order_date: string | null;
  payment_environment: "test" | "production" | null;
  plan: BillingPlan;
  amount_cents: number;
  role: OrderRole;
  kind: OrderKind;
  created_at: string;
};

const ORDER_COLUMNS =
  "id, subscription_id, monetico_reference, monetico_order_date, payment_environment, plan, amount_cents, role, kind, created_at";

/**
 * Retrouve les paramètres bancaires attachés à une référence.
 *
 * Ordre de résolution, et c'est important : la COMMANDE d'abord, l'abonnement
 * ensuite. Sans cela, une écriture comptable ancienne encore à encaisser
 * deviendrait inencaissable dès la première bascule de commande — la date
 * envoyée à la banque serait celle de la nouvelle commande, et le service de
 * capture répondrait « commande non authentifiee », définitivement.
 */
export async function orderContext(
  supabase: SupabaseClient,
  reference: string,
): Promise<OrderContext | null> {
  const { data: orderData } = await supabase
    .from("subscription_orders")
    .select(ORDER_COLUMNS)
    .eq("monetico_reference", reference)
    .maybeSingle();

  if (orderData) {
    const order = orderData as OrderRow;
    return {
      orderId: order.id,
      subscriptionId: order.subscription_id,
      reference: order.monetico_reference,
      orderDate: order.monetico_order_date,
      fallbackDateIso: order.created_at,
      plan: order.plan,
      amountCents: order.amount_cents,
      role: order.role,
      kind: order.kind,
      platform: order.payment_environment,
    };
  }

  /* Repli : abonnement dont la commande n'a pas encore été reprise (migration
     0028 non passée, ou ligne créée entre-temps par un chemin ancien). */
  const { data: subData } = await supabase
    .from("subscriptions")
    .select(
      "id, monetico_reference, monetico_order_date, payment_environment, started_at, first_payment_cents, plan",
    )
    .eq("monetico_reference", reference)
    .maybeSingle();
  if (!subData) return null;

  const sub = subData as {
    id: string;
    monetico_reference: string;
    monetico_order_date: string | null;
    payment_environment: "test" | "production" | null;
    started_at: string;
    first_payment_cents: number;
    plan: BillingPlan;
  };
  return {
    orderId: null,
    subscriptionId: sub.id,
    reference: sub.monetico_reference,
    orderDate: sub.monetico_order_date,
    fallbackDateIso: sub.started_at,
    plan: sub.plan,
    amountCents: sub.first_payment_cents,
    role: sub.plan === "MONTHLY" ? "recurring" : "oneshot",
    kind: null,
    platform: sub.payment_environment,
  };
}

/** Commande récurrente actuellement vivante d'un abonnement (null si aucune). */
export async function currentRecurringOrder(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<OrderContext | null> {
  const { data } = await supabase
    .from("subscription_orders")
    .select(ORDER_COLUMNS)
    .eq("subscription_id", subscriptionId)
    .eq("role", "recurring")
    .eq("status", "applied")
    .is("superseded_at", null)
    .maybeSingle();
  if (!data) return null;
  const order = data as OrderRow;
  return {
    orderId: order.id,
    subscriptionId: order.subscription_id,
    reference: order.monetico_reference,
    orderDate: order.monetico_order_date,
    fallbackDateIso: order.created_at,
    plan: order.plan,
    amountCents: order.amount_cents,
    role: order.role,
    kind: order.kind,
    platform: order.payment_environment,
  };
}

/* ------------------------------------------------------------
   Ouverture d'une commande.
   ------------------------------------------------------------ */

export type OpenOrderInput = {
  kind: OrderKind;
  plan: BillingPlan;
  extraCollaborators: number;
  amountCents: number;
  appCabinetId: string;
  appUserId?: string | null;
  /** null pour une souscription : le contrat n'existe pas encore. */
  subscriptionId?: string | null;
  /** Commande remplacée (changement de carte, changement de formule). */
  supersedesOrderId?: string | null;
  /** Identité de facturation figée (nom, adresse, CP + ville, email admin). */
  billingSnapshot: {
    cabinetName: string;
    cabinetAddress: string;
    cabinetPostalCity: string;
    adminEmail: string;
    adminName: string;
    invoicePrefix: string;
  };
  consentRecordId?: string | null;
  clientIp?: string | null;
  createdByAdmin?: string | null;
  /**
   * Chemin de retour après paiement, sans la référence
   * (ex. "/mon-abonnement/merci").
   *
   * VOLONTAIREMENT UN CHEMIN, PAS UNE URL : l'origine est calculée ici, à
   * partir de NEXT_PUBLIC_SITE_URL. Elle ne doit JAMAIS venir de la requête —
   * `request.nextUrl.origin` vaut « https://0.0.0.0:3000 » en production (le
   * serveur standalone se rabat sur HOSTNAME et PORT), et cette URL part
   * SCELLÉE DANS LE MAC vers Monetico : le client serait débité puis renvoyé
   * sur une adresse injoignable, sans rattrapage possible.
   */
  returnPath: string;
  /**
   * Chemin de retour en cas de REFUS (ex. "/mon-abonnement/echec").
   *
   * OBLIGATOIRE, et distinct de `returnPath` : Monetico refuse que
   * `url_retour_ok` et `url_retour_err` soient identiques, et l'a signalé sur
   * ce contrat. Le rendre obligatoire plutôt que dérivé d'un défaut est
   * délibéré — c'est ce qui force chaque nouveau parcours de paiement à
   * décider où atterrit un client refusé, au lieu de le renvoyer par
   * inadvertance sur un écran de remerciement.
   */
  errorPath: string;
};

export type OpenedOrder = {
  orderId: string;
  reference: string;
  form: SealedPaymentForm;
};

/** Découpe "13320 Bouc-Bel-Air" en code postal + ville pour le contexte 3DS. */
function splitPostalCity(value: string): { postalCode: string; city: string } {
  const trimmed = value.trim();
  const m = /^(\d{5})\s+(.+)$/.exec(trimmed);
  return {
    postalCode: m?.[1] ?? "",
    city: m?.[2] ?? (trimmed || "—"),
  };
}

/**
 * Ouvre une commande et rend le formulaire Monetico scellé.
 *
 * L'ordre compte : le formulaire est construit AVANT l'insertion pour que la
 * date de commande enregistrée soit exactement celle qui part à la banque.
 * Une date décalée d'un jour rendrait l'arrêt de récurrence et la mise en
 * recouvrement impossibles.
 */
export async function openOrder(
  supabase: SupabaseClient,
  input: OpenOrderInput,
): Promise<OpenedOrder> {
  const reference = await newOrderReference(supabase);
  const config = moneticoConfigForPlan(input.plan);
  const { postalCode, city } = splitPostalCity(input.billingSnapshot.cabinetPostalCity);
  /* Même source que le tunnel d'inscription, qui lui fonctionne en production. */
  const siteUrl = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const returnUrl = `${siteUrl}${input.returnPath}?ref=${reference}`;
  const errorUrl = `${siteUrl}${input.errorPath}?ref=${reference}`;

  const form = buildPaymentForm(
    {
      reference,
      amountCents: input.amountCents,
      email: input.billingSnapshot.adminEmail,
      urlRetourOk: returnUrl,
      urlRetourErr: errorUrl,
      billingContext: {
        addressLine1: input.billingSnapshot.cabinetAddress || "—",
        city,
        postalCode,
        country: "FR",
      },
    },
    config,
  );

  const { data, error } = await supabase
    .from("subscription_orders")
    .insert({
      subscription_id: input.subscriptionId ?? null,
      app_cabinet_id: input.appCabinetId,
      app_user_id: input.appUserId ?? null,
      kind: input.kind,
      role: input.plan === "MONTHLY" ? "recurring" : "oneshot",
      plan: input.plan,
      extra_collaborators: input.extraCollaborators,
      amount_cents: input.amountCents,
      currency: "EUR",
      monetico_reference: reference,
      monetico_tpe: config.tpe,
      /* La plateforme est constatée ICI, au seul instant où on la connaît de
         source sûre. La déduire plus tard de MONETICO_MODE reviendrait à lire
         la configuration d'aujourd'hui pour une commande d'hier. */
      payment_environment: config.mode,
      payment_provider: "monetico",
      monetico_order_date: form.fields["date"].slice(0, 10),
      status: "pending",
      supersedes_order_id: input.supersedesOrderId ?? null,
      billing_snapshot: input.billingSnapshot,
      consent_record_id: input.consentRecordId ?? null,
      expires_at: new Date(
        Date.now() + ORDER_TTL_MINUTES * 60_000,
      ).toISOString(),
      client_ip: input.clientIp ?? null,
      created_by_admin: input.createdByAdmin ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`insert subscription_orders : ${error?.message ?? "aucune ligne"}`);
  }

  return { orderId: data.id as string, reference, form };
}

/* ------------------------------------------------------------
   Transitions.
   ------------------------------------------------------------ */

/**
 * Verrou de traitement d'un paiement : 'pending' → 'paid'.
 * Renvoie false si la transition n'a pas eu lieu (déjà traitée) : l'appelant
 * doit alors s'arrêter, c'est la garde d'idempotence des finalisations.
 */
export async function claimOrderPaid(
  supabase: SupabaseClient,
  orderId: string,
  paidAt: Date,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscription_orders")
    .update({ status: "paid", paid_at: paidAt.toISOString() })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id");
  return Boolean(data && data.length > 0);
}

/** Effets appliqués au contrat : 'paid' → 'applied' (terminal). */
export async function markOrderApplied(
  supabase: SupabaseClient,
  orderId: string,
  subscriptionId: string,
): Promise<void> {
  await supabase
    .from("subscription_orders")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      subscription_id: subscriptionId,
    })
    .eq("id", orderId);
}

/** Commande refusée par la banque (terminal). */
export async function markOrderFailed(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  await supabase
    .from("subscription_orders")
    .update({ status: "failed" })
    .eq("id", orderId)
    .in("status", ["pending", "paid"]);
}

/**
 * Retire une commande récurrente de la circulation.
 * À n'appeler QU'APRÈS accusé bancaire positif de l'arrêt de récurrence :
 * marquer une commande remplacée alors qu'elle prélève encore, c'est perdre
 * la trace du prélèvement qui continue.
 */
export async function supersedeOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  await supabase
    .from("subscription_orders")
    .update({ superseded_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("superseded_at", null);
}
