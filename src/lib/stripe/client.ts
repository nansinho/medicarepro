import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/* ============================================================
   Accès à Stripe — un seul endroit décide.

   Même doctrine que monetico-routing.ts : aucune route ne construit sa propre
   configuration d'encaissement. C'est ce qui a permis, le 05/08/2026, de
   constater d'un coup d'œil qu'une seule route composait son TPE à la main et
   envoyait les offres 12 mois sur le contrat mensuel.

   L'INSTANCE EST PARESSEUSE, ET C'EST VOULU. Le module est importé par des
   routes qui doivent répondre même sans configuration de paiement (la page
   d'abonnement se consulte, les factures se téléchargent). Construire le client
   au chargement du module ferait échouer l'import lui-même quand la clé manque.

   LE MODE (test ou production) N'EST PAS UNE VARIABLE ICI. Stripe le porte dans
   la clé : `sk_test_…` ou `sk_live_…`. On le LIT donc plutôt que de le déclarer,
   parce qu'une déclaration peut mentir — c'est exactement ce qui est arrivé avec
   MONETICO_MODE, qui affirmait « production » pendant que les commandes vivaient
   sur la plateforme d'essai.
   ============================================================ */

let instance: Stripe | null = null;

/** Clé secrète configurée ? Les routes de lecture n'en ont pas besoin. */
export function hasStripe(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}

/**
 * Le client Stripe. Jette si la clé manque : à n'appeler que depuis un chemin
 * qui encaisse, jamais depuis une page qui se contente d'afficher.
 */
export function stripe(): Stripe {
  if (instance) return instance;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquante : encaissement impossible.");
  }
  instance = new Stripe(key, {
    /* Repris tel quel dans les journaux de Stripe : quand une transaction part
       de travers, on veut savoir quelle application l'a émise. */
    appInfo: { name: "MediCare Pro", url: "https://medicarepro.fr" },
    /* Le SDK réessaie les erreurs réseau et les 5xx, avec sa clé
       d'idempotence propre. Deux reprises suffisent : au-delà, l'appelant est
       mieux placé pour décider (alerte, file de rattrapage). */
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return instance;
}

/**
 * Encaisse-t-on pour de vrai ? Lu depuis la clé, jamais déclaré.
 *
 * Sert à étiqueter chaque commande, chaque contrat et chaque écriture
 * comptable, pour qu'on sache toujours de quel monde vient une notification.
 * Sans cette trace, une bascule test → production rend toutes les commandes
 * antérieures injoignables sans que rien ne le signale : c'est la leçon de la
 * migration 0033, et Stripe a rigoureusement le même piège.
 */
export function stripeLiveMode(): boolean {
  return (env().STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/** Le site est-il servi en ligne alors que Stripe est en clé de test ? */
export function stripeTestKeyOnLiveSite(): boolean {
  if (!hasStripe()) return false;
  if (stripeLiveMode()) return false;
  if (process.env.NODE_ENV !== "production") return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(
    env().NEXT_PUBLIC_SITE_URL,
  );
}
