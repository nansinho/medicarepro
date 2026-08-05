import "server-only";
import type Stripe from "stripe";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   Le miroir des factures Stripe.

   CE QUI L'A RENDU NÉCESSAIRE. La première souscription Stripe a produit DEUX
   factures pour un seul paiement : celle de Stripe, et la nôtre. Deux
   numérotations, deux pièces comptables, un encaissement. Le client a choisi
   que Stripe facture : nous cessons d'émettre, mais nous gardons un registre.

   POURQUOI GARDER UN REGISTRE PLUTÔT QUE DE RENVOYER VERS STRIPE. L'espace du
   praticien et le back-office listent les factures depuis notre table, avec un
   contrôle d'accès par cabinet de session. Renvoyer chacun chercher chez Stripe
   demanderait de leur ouvrir un accès à un tableau de bord qui ne les regarde
   pas, et perdrait l'historique le jour où on changerait de prestataire.

   On ne recopie donc que ce qui sert à lire : numéro, montant, date, et
   l'adresse du document. Le PDF reste chez Stripe, c'est leur pièce.
   ============================================================ */

/** Le type de pièce, tel que notre registre le nomme. */
function kindOf(
  invoice: Stripe.Invoice,
): "card_first" | "card_renewal" | "card_change" {
  switch (invoice.billing_reason) {
    case "subscription_create":
      /* La toute première facture d'un abonnement. */
      return "card_first";
    case "subscription_update":
      /* Un changement de formule ou d'effectif encaissé sur-le-champ. Ce n'est
         PAS une reconduction : dans un registre comptable, confondre un
         supplément avec une échéance fausse la lecture de l'historique d'un
         cabinet — l'admin affichait « Reconduction carte » pour un ajout de
         collaborateurs. */
      return "card_change";
    default:
      /* `subscription_cycle` et les autres : l'échéance suivante. */
      return "card_renewal";
  }
}

/**
 * Enregistre une facture Stripe dans notre registre, sans la dupliquer.
 *
 * Idempotent par `stripe_invoice_id`, qui porte un index unique : Stripe
 * re-livre ses événements, et une facture comptée deux fois fausserait
 * l'historique que lit le praticien.
 *
 * Ne jette jamais : une facture non miroitée est un défaut d'affichage, pas une
 * raison de faire échouer un encaissement qui a eu lieu.
 */
export async function mirrorStripeInvoice(
  invoice: Stripe.Invoice,
  subscriptionId: string | null,
): Promise<{ ok: boolean; number?: string; reason?: string }> {
  const supabase = serviceClient();
  if (!supabase) return { ok: false, reason: "base non configurée" };

  if (!invoice.id) return { ok: false, reason: "facture sans identifiant" };
  /* Le numéro n'existe qu'une fois la facture finalisée. Une facture payée l'est
     toujours ; s'il manque, c'est que l'objet n'est pas celui qu'on croit. */
  if (!invoice.number) return { ok: false, reason: "facture sans numéro" };

  const { error } = await supabase.from("invoices").insert({
    number: invoice.number,
    subscription_id: subscriptionId,
    kind: kindOf(invoice),
    amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
    currency: (invoice.currency ?? "eur").toUpperCase(),
    issued_at: new Date((invoice.created ?? Date.now() / 1000) * 1000).toISOString(),
    /* Ni chemin ni empreinte : le document n'est pas chez nous. La contrainte
       de la migration 0035 exige alors l'adresse hébergée. */
    pdf_path: null,
    pdf_sha256: null,
    stripe_invoice_id: invoice.id,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    meta: {
      provider: "stripe",
      billing_reason: invoice.billing_reason ?? null,
      /* Ce que Stripe a calculé de TVA, conservé pour que le registre puisse
         répondre sans rappeler leur API. */
      tax_cents: invoice.total_taxes?.[0]?.amount ?? null,
    },
  });

  if (error) {
    // 23505 : déjà miroitée, c'est le comportement attendu d'une re-livraison.
    if (error.code === "23505") return { ok: true, number: invoice.number };
    return { ok: false, reason: error.message };
  }
  return { ok: true, number: invoice.number };
}
