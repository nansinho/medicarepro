import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/env";
import { siteUrl } from "@/lib/http/site-url";
import { MAX_EXTRA_COLLABORATORS, type BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   Ouverture d'une session de paiement Stripe.

   LE MONTANT NE VIENT PAS D'ICI. On envoie des identifiants de prix, et Stripe
   applique ceux de son catalogue. Le navigateur ne peut donc rien influencer,
   et nous non plus : notre grille tarifaire ne sert plus qu'à afficher. C'est
   une garantie que le formulaire Monetico n'offrait pas, où le montant partait
   dans le champ `montant` et n'était protégé que par le sceau.

   NOTRE RÉFÉRENCE RESTE LA CLÉ. Le « MP + 10 caractères » produit par
   newOrderReference devient le `client_reference_id` de la session ET une
   métadonnée de l'abonnement. Toute la chaîne existante s'y adosse : clé
   d'idempotence du provisioning, AAD de chiffrement des mots de passe, clé du
   journal comptable, ligne « référence de paiement » imprimée sur la facture.

   La poser AUSSI sur l'abonnement n'est pas une redondance. `client_reference_id`
   ne vit que sur la session : les `invoice.paid` des mois suivants ne le
   porteraient pas, et une reconduction arriverait sans qu'on sache à quel
   contrat la rattacher.
   ============================================================ */

export type CheckoutInput = {
  /** Notre référence « MP + 10 ». Devient client_reference_id ET métadonnée. */
  reference: string;
  plan: BillingPlan;
  extraCollaborators: number;
  /**
   * Client Stripe déjà porteur de l'adresse de facturation complète.
   *
   * Préféré à `customerEmail` : une session ouverte avec la seule adresse
   * électronique produit une facture où le destinataire se réduit à un nom et
   * un pays. L'adresse du destinataire est une mention obligatoire.
   */
  customerId?: string;
  /** Repli quand aucun client Stripe n'a pu être créé. */
  customerEmail?: string;
  /** Chemin de retour après acceptation, ex. « /mon-abonnement/merci ». */
  successPath: string;
  /** Chemin de retour après abandon ou refus. JAMAIS le même que le succès. */
  errorPath: string;
  /** Métadonnées supplémentaires, reprises sur la session et l'abonnement. */
  metadata?: Record<string, string>;
  /**
   * Versements convenus, dans l'ordre, quand le praticien choisit d'échelonner.
   * Absent ou vide = paiement comptant. Réservé à l'offre 12 mois.
   */
  instalments?: number[];
};

/**
 * Construit les paramètres de la session, sans appeler Stripe.
 *
 * Séparé de l'appel pour être vérifiable : c'est ici que se jouent le choix des
 * prix, la quantité de collaborateurs et les adresses de retour, c'est-à-dire
 * tout ce qui peut faire payer le mauvais montant ou renvoyer un client refusé
 * sur un écran de remerciement.
 */
export function buildCheckoutParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  if (!Number.isInteger(input.extraCollaborators) || input.extraCollaborators < 0) {
    throw new Error("Nombre de collaborateurs invalide.");
  }
  if (input.extraCollaborators > MAX_EXTRA_COLLABORATORS) {
    throw new Error(
      `Nombre de collaborateurs au-delà du maximum (${MAX_EXTRA_COLLABORATORS}).`,
    );
  }
  if (!input.customerId && !input.customerEmail) {
    throw new Error("Ni client Stripe ni adresse électronique : session refusée.");
  }
  if (input.successPath === input.errorPath) {
    /* Monetico l'a laissé passer sur les quatre points d'entrée : une carte
       refusée renvoyait sur « merci ». */
    throw new Error("Les chemins de retour accepté et refusé doivent différer.");
  }

  const { prices, taxRate } = stripeConfig();
  if (!taxRate) {
    /* Sans taux, la facture sort sans ligne de TVA. Refuser la vente est le
       moindre mal : une facture non conforme se découvre des mois plus tard,
       chez le comptable du cabinet. */
    throw new Error(
      "Aucun taux de TVA Stripe configuré : souscription refusée plutôt que facturée sans TVA.",
    );
  }
  const annuel = input.plan === "ANNUAL";
  const basePrice = annuel ? prices.annual : prices.monthly;
  const collabPrice = annuel ? prices.collaboratorAnnual : prices.collaboratorMonthly;

  if (!basePrice) {
    throw new Error(`Aucun prix Stripe configuré pour la formule ${input.plan}.`);
  }
  if (input.extraCollaborators > 0 && !collabPrice) {
    /* Sans ce refus, la souscription partirait au tarif du titulaire seul et le
       cabinet paierait moins que ce qu'il a lu à l'écran. */
    throw new Error(
      `Prix collaborateur Stripe absent pour la formule ${input.plan} : souscription refusée plutôt que sous-facturée.`,
    );
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: basePrice, quantity: 1 },
  ];
  if (input.extraCollaborators > 0 && collabPrice) {
    lineItems.push({ price: collabPrice, quantity: input.extraCollaborators });
  }

  /* Contrôles de l'échelonnement. Le montage lui-même est plus bas : il ne
     produit PAS une session d'abonnement, et c'est expliqué là où il se joue. */
  const versements = input.instalments ?? [];
  if (versements.length > 0) {
    if (!annuel) {
      /* Le mensuel est déjà un étalement : le redécouper produirait des
         versements de dix euros pour un coût de traitement identique. */
      throw new Error("Le paiement en plusieurs fois n'existe que sur l'offre 12 mois.");
    }
    if (versements.length < 2) {
      throw new Error("Un échelonnement demande au moins deux versements.");
    }
    if (versements.some((v) => !Number.isInteger(v) || v <= 0)) {
      throw new Error("Montant de versement invalide.");
    }
  }

  const metadata = {
    ...input.metadata,
    reference: input.reference,
    ...(versements.length > 0
      ? {
          instalments: String(versements.length),
          /* Repris à l'identique quand NOUS créerons l'abonnement, après le
             paiement : la session en mode paiement n'en porte aucun, donc ces
             deux valeurs sont le seul moyen de savoir quoi ouvrir. */
          plan: input.plan,
          collaborators: String(input.extraCollaborators),
        }
      : {}),
  };

  const client = input.customerId
    ? {
        customer: input.customerId,
        customer_update: { address: "auto" as const, name: "auto" as const },
      }
    : { customer_email: input.customerEmail };

  /* ---------- RÈGLEMENT EN PLUSIEURS FOIS ----------

     UNE SESSION DE PAIEMENT, PAS D'ABONNEMENT, et c'est tout le sujet.

     Le premier montage passait par un abonnement doté d'une « période d'essai »
     de douze mois. Il fonctionnait et prélevait le bon montant, mais Stripe
     ajoutait d'office à la facture une ligne à 0 € libellée « Essai gratuit » —
     sur un document où le praticien venait de payer 99,36 €, et qu'il remet à
     son comptable. Cette ligne n'est ni paramétrable, ni modifiable après coup
     (« This invoice is no longer editable », mesuré le 06/08/2026).

     Ici on encaisse le premier versement comme un achat simple : la facture ne
     porte QUE notre ligne, avec notre libellé. L'abonnement des douze mois est
     ouvert juste après, par nous, ancré à un an et sans prorata — ce que
     l'API accepte alors que Checkout le refuse dès qu'une ligne ponctuelle est
     présente. Il naît « actif », sans essai et sans facture.

     POURQUOI ENCAISSER ICI ET PAS APRÈS COUP. Le praticien est devant son
     écran, sa banque peut lui demander une validation 3-D Secure et il la donne
     dans la seconde. Un prélèvement lancé hors sa présence n'a pas cette
     chance : c'est le premier versement, celui qui ouvre le compte, et il doit
     aboutir. La carte est conservée pour les deux suivants. */
  if (versements.length > 0) {
    const libelle = `Offre 12 mois MediCare Pro : 1er versement sur ${versements.length}`;
    return {
      mode: "payment",
      locale: "fr",
      client_reference_id: input.reference,
      ...client,
      metadata,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: versements[0],
            /* Nos prix de catalogue sont TTC : sans cette mention la TVA
               s'ajouterait par-dessus et le praticien paierait 119,23 €. */
            tax_behavior: "inclusive",
            product_data: { name: libelle },
          },
          quantity: 1,
          /* En mode paiement il n'y a pas de `subscription_data` pour porter le
             taux : sans lui la facture sort sans ligne de TVA, et une facture
             française sans TVA ne vaut rien pour la comptabilité du cabinet. */
          tax_rates: [taxRate],
        },
      ],
      /* Sans ça, Stripe n'émet qu'un reçu de paiement. Le praticien a droit à
         une vraie facture, numérotée, avec l'adresse du cabinet. */
      invoice_creation: {
        enabled: true,
        invoice_data: { metadata, description: libelle },
      },
      payment_intent_data: {
        /* CONSERVE LA CARTE pour les deux versements suivants. Sans elle, il n'y
           aurait tout simplement rien à prélever le mois prochain. */
        setup_future_usage: "off_session",
        metadata,
        description: libelle,
      },
      custom_text: {
        submit: {
          message: `Vous réglez aujourd'hui le 1er de ${versements.length} versements. Les ${versements.length - 1} suivants seront prélevés automatiquement sur cette carte, à un mois d'intervalle. Votre accès est ouvert pour douze mois dès ce paiement ; en cas de versement refusé, il passe en lecture seule jusqu'au règlement. Vos données de santé sont hébergées en France, chez un hébergeur agréé HDS.`,
        },
      },
      success_url: `${siteUrl(input.successPath)}?ref=${encodeURIComponent(input.reference)}`,
      cancel_url: `${siteUrl(input.errorPath)}?ref=${encodeURIComponent(input.reference)}`,
    };
  }

  return {
    mode: "subscription",
    line_items: lineItems,
    /* AUCUNE LISTE DE MOYENS DE PAIEMENT : c'est le tableau de bord Stripe qui
       décide, et lui seul sait ce qui est réellement activé sur le compte.

       On imposait ["card", "sepa_debit"]. Stripe valide la liste ENTIÈRE avant
       d'ouvrir la page : le prélèvement SEPA n'étant pas activé sur le compte
       réel, il refusait toute session — y compris pour un client qui voulait
       payer par carte, et qui n'atteignait donc jamais la page de paiement.
       Constaté le 06/08/2026 à la première mise en production.

       En laissant Stripe choisir, activer le SEPA plus tard ne demandera aucun
       déploiement, et couper un moyen de paiement ne cassera plus la vente. */
    locale: "fr",
    client_reference_id: input.reference,
    /* L'un OU l'autre : Stripe refuse les deux ensemble. `customer_update`
       autorise Stripe à corriger l'adresse si le client la rectifie sur la page
       de paiement, plutôt que de la figer à notre copie. */
    ...client,
    metadata,
    /* CE QUE LE PRATICIEN LIT JUSTE AVANT DE PAYER.

       La page de Stripe est sobre par construction, et c'est une qualité : rien
       ne doit distraire d'un formulaire de carte. Mais elle ne dit rien de ce
       qui rassure un professionnel de santé au moment de sortir sa carte —
       où vivent ses données, et s'il est engagé.

       Ces deux lignes ne sont pas du décor : ce sont les deux questions qu'on
       nous pose le plus, et les laisser sans réponse à cet instant précis est
       ce qui fait fermer un onglet. Le reste de l'habillage (bandeau bleu,
       logo) vient de la marque du compte, qui ne se règle pas ici. */
    custom_text: {
      submit: {
        message:
          "Vos données de santé sont hébergées en France, chez un hébergeur agréé HDS. Vous pouvez arrêter la reconduction à tout moment depuis votre espace abonnement : votre accès reste ouvert jusqu'au terme de la période réglée.",
      },
    },
    subscription_data: {
      metadata,
      /* Stripe n'a pas de taux par défaut au niveau du compte : il doit être
         passé ici, à chaque abonnement créé. */
      default_tax_rates: [taxRate],
      /* Le libellé repris sur la facture et sur le relevé bancaire du
         praticien. Sans lui, il lit une ligne « MediCare Pro » sans savoir de
         quelle formule il s'agit. */
      description: `Abonnement MediCare Pro : ${
        input.plan === "ANNUAL" ? "offre 12 mois" : "mensuel sans engagement"
      }${
        input.extraCollaborators > 0
          ? ` + ${input.extraCollaborators} collaborateur${input.extraCollaborators > 1 ? "s" : ""}`
          : ""
      }`,
    },
    /* Calculées par siteUrl(), JAMAIS depuis la requête : en production le
       serveur standalone dérive « https://0.0.0.0:3000 » de HOSTNAME et PORT,
       et un client payé serait renvoyé sur une adresse injoignable. */
    success_url: `${siteUrl(input.successPath)}?ref=${encodeURIComponent(input.reference)}`,
    cancel_url: `${siteUrl(input.errorPath)}?ref=${encodeURIComponent(input.reference)}`,
  };
}

/**
 * Ouvre la session et rend l'adresse où envoyer le client.
 *
 * L'idempotence porte sur NOTRE référence : un double clic, ou une reprise
 * réseau, rouvre la même session au lieu d'en créer une seconde. Deux sessions
 * pour une commande, c'est un client qui peut payer deux fois.
 */
export async function createSubscriptionCheckout(
  input: CheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const session = await stripe().checkout.sessions.create(
    buildCheckoutParams(input),
    { idempotencyKey: `checkout:${input.reference}` },
  );
  if (!session.url) {
    throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.");
  }
  return { url: session.url, sessionId: session.id };
}
