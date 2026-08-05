import "server-only";
import { stripe } from "@/lib/stripe/client";

/* ============================================================
   Le client Stripe d'un cabinet.

   POURQUOI CE MODULE EXISTE. La première facture réelle, le 05/08/2026,
   portait « HARUA — France » et rien d'autre : ni rue, ni code postal, ni
   ville. Une session Checkout ouverte avec `customer_email` seul ne transmet
   que l'adresse électronique, et Stripe imprime ce qu'il a. Or l'adresse du
   destinataire est une mention obligatoire d'une facture française.

   Nous l'avons pourtant, figée dans le `billing_snapshot` de la commande. Il
   suffisait de la donner.

   UN CABINET, UN CLIENT STRIPE. On retrouve le client par l'identifiant du
   cabinet rangé dans ses métadonnées, plutôt que par son email : un praticien
   change d'adresse électronique, un cabinet ne change pas d'identité. Deux
   clients Stripe pour un même cabinet, ce serait deux abonnements parallèles
   sans que rien ne les relie.
   ============================================================ */

export type CabinetBilling = {
  appCabinetId: string;
  name: string;
  email: string;
  /** Rue et complément, tels que saisis dans l'application. */
  address: string;
  /** « 13090 AIX EN PROVENCE » — découpé ici. */
  postalCity: string;
};

/** Découpe « 13090 Aix-en-Provence » en code postal et ville. */
export function splitPostalCity(value: string): {
  postalCode: string;
  city: string;
} {
  const trimmed = value.trim();
  const m = /^(\d{5})\s+(.+)$/.exec(trimmed);
  return { postalCode: m?.[1] ?? "", city: m?.[2] ?? (trimmed || "") };
}

/**
 * Retrouve le client Stripe du cabinet, ou le crée avec son adresse complète.
 *
 * Ne jette pas sur un échec de recherche : mieux vaut un client de plus qu'une
 * souscription refusée. Un doublon se corrige à la main, une vente perdue ne se
 * rattrape pas.
 */
export async function ensureStripeCustomer(
  cabinet: CabinetBilling,
): Promise<string> {
  const s = stripe();
  const { postalCode, city } = splitPostalCity(cabinet.postalCity);

  const identite = {
    name: cabinet.name,
    email: cabinet.email,
    address: {
      line1: cabinet.address || undefined,
      postal_code: postalCode || undefined,
      city: city || undefined,
      country: "FR",
    },
    metadata: { app_cabinet_id: cabinet.appCabinetId },
  };

  try {
    const trouves = await s.customers.search({
      query: `metadata['app_cabinet_id']:'${cabinet.appCabinetId}'`,
      limit: 1,
    });
    const existant = trouves.data[0];
    if (existant) {
      /* Mise à jour à chaque passage : l'adresse vient de l'application métier,
         qui fait foi. Une facture émise dans six mois doit porter l'adresse
         d'alors, pas celle de la première souscription. */
      await s.customers.update(existant.id, identite);
      return existant.id;
    }
  } catch (err) {
    console.error(
      "[stripe-customer] recherche impossible, création directe :",
      err instanceof Error ? err.message : String(err),
    );
  }

  const cree = await s.customers.create(identite);
  return cree.id;
}

/**
 * Le client Stripe d'un cabinet QUI N'EXISTE PAS ENCORE.
 *
 * Au tunnel de vente, le cabinet n'est créé dans l'application qu'APRÈS le
 * paiement : il n'y a donc pas d'identifiant sur lequel se caler. On se rabat
 * sur notre référence de dossier, qui est allouée avant le paiement et ne
 * change plus.
 *
 * Idempotent par cette référence : un client qui revient sur sa page de paiement
 * retrouve le même client Stripe, au lieu d'en semer un à chaque tentative.
 */
export async function createSignupCustomer(input: {
  /** Notre référence « MP + 10 » du dossier d'inscription. */
  reference: string;
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
}): Promise<string> {
  const s = stripe();
  const identite = {
    name: input.name,
    email: input.email,
    address: {
      line1: input.address || undefined,
      postal_code: input.postalCode || undefined,
      city: input.city || undefined,
      country: "FR",
    },
    metadata: { signup_reference: input.reference },
  };

  try {
    const trouves = await s.customers.search({
      query: `metadata['signup_reference']:'${input.reference}'`,
      limit: 1,
    });
    const existant = trouves.data[0];
    if (existant) {
      await s.customers.update(existant.id, identite);
      return existant.id;
    }
  } catch (err) {
    console.error(
      "[stripe-customer] recherche inscription impossible, création directe :",
      err instanceof Error ? err.message : String(err),
    );
  }

  const cree = await s.customers.create(identite);
  return cree.id;
}

/**
 * Rattache un client Stripe né d'une inscription au cabinet enfin créé.
 *
 * SANS CETTE ÉTAPE, le cabinet aurait deux clients Stripe : celui du tunnel,
 * porteur de son historique et de son abonnement, et celui qu'`ensureStripeCustomer`
 * créerait au premier changement de formule faute de trouver `app_cabinet_id`.
 * L'historique de facturation se scinderait en deux sans que rien ne l'annonce.
 *
 * Best-effort : un échec ici ne remet en cause ni le paiement, ni le compte.
 */
export async function linkStripeCustomerToCabinet(
  customerId: string,
  appCabinetId: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await stripe().customers.update(customerId, {
      metadata: { app_cabinet_id: appCabinetId },
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message.slice(0, 200) : "erreur inconnue",
    };
  }
}
