/* ============================================================
   Interrupteur « l'inscription se fait dans le logiciel ».

   Décision du 1er novembre 2026 : la vitrine ne gère plus que le site.
   Inscription, paiement, formule, reconduction et accès offerts vivent dans
   l'application (app.medicarepro.fr), qui parle à Stripe directement. Tant
   que l'application n'a pas mis ce parcours en ligne, la vitrine continue
   d'encaisser : d'où un interrupteur, et non une suppression.

   INSCRIPTION_DANS_APP=true fait trois choses, et rien d'autre :
     1. les boutons « S'inscrire » du site mènent à l'application ;
     2. le tunnel /inscription et POST /api/checkout refusent les NOUVEAUX
        dossiers payants ;
     3. le back-office n'émet plus d'invitation d'accès offert.

   Ce qui continue, parce que des praticiens sont au milieu du chemin :
   les invitations déjà envoyées (lien valable 60 jours), les reprises de
   paiement d'un dossier existant, la souscription depuis l'espace client
   d'un cabinet encore suivi par la vitrine, les rappels et les fins de
   période. Ces parcours s'éteignent d'eux-mêmes ; leur code part dans un
   chantier séparé.

   Lu directement dans process.env, pas via env() : ce module est importé
   par appLinks, lui-même importé d'un composant client (SiteHeader, pour
   loginUrl). Faire transiter le schéma zod de l'environnement serveur par
   un bundle navigateur n'a aucun sens. Conséquence à connaître : côté
   navigateur la variable n'existe pas, la fonction répond toujours false.
   registerUrl() ne doit donc être évaluée que dans des composants serveur,
   ce qui est le cas aujourd'hui (Kit, PricingBlocks, SitePromo).
   ============================================================ */

export function inscriptionDansApp(): boolean {
  return lireInterrupteur(process.env.INSCRIPTION_DANS_APP);
}

/** Même tolérance que PAYMENT_PROVIDER : guillemets, espaces et casse ignorés. */
export function lireInterrupteur(valeur: string | undefined): boolean {
  const brut = (valeur ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return brut === "true" || brut === "1" || brut === "oui";
}
