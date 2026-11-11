# L'inscription se fait dans le logiciel

Décision du 1er novembre 2026 : la vitrine medicarepro.fr ne gère plus que le site.
Inscription, paiement, changement de formule, reconduction, reprise et accès offerts
vivent dans l'application (dépôt `podiatry-patient-profile`, branche
`feat/abonnements-dans-l-app`, dev B). La vitrine ne fait plus que renvoyer vers elle.

Tant que l'application n'a pas mis ce parcours en ligne, la vitrine continue d'encaisser.
D'où un interrupteur plutôt qu'une suppression : `INSCRIPTION_DANS_APP`.

## Ce que fait l'interrupteur

`INSCRIPTION_DANS_APP=true` (lu à chaque requête, les pages du site sont dynamiques) :

| Où | Avant | Après |
|---|---|---|
| Boutons « S'inscrire » du site, CTA du contenu CMS (`app:register*`), page tarifs | `/inscription?plan=…` | `NEXT_PUBLIC_APP_URL/register?plan=monthly|annual` |
| Page `/inscription` sans `?invitation=` | tunnel de la vitrine | redirection vers l'application, formule conservée |
| `POST /api/checkout` sans invitation | ouvre un dossier payant | `410` avec l'adresse du nouveau tunnel |

Code : `src/lib/inscription-dans-app.ts` (lecture de la variable), `src/lib/appLinks.ts`
(`registerUrl`, `appRegisterUrl`, `vitrineRegisterUrl`), et les trois points ci-dessus.

## Ce qui continue, volontairement

Des praticiens sont au milieu du chemin. Ces parcours restent ouverts et s'éteignent
d'eux-mêmes :

- les invitations d'accès offert déjà envoyées (lien valable 60 jours) : `/inscription?invitation=…`
  et `POST /api/checkout` avec jeton passent (plus d'écran pour les renvoyer ou les retirer) ;
- la reprise de paiement d'un dossier existant (`POST /api/checkout/retry`) ;
- la souscription depuis l'espace client d'un cabinet encore suivi par la vitrine
  (`POST /api/portal/subscribe`), typiquement à la fin d'une période offerte ;
- les rappels d'échéance, les fins de période, le webhook Stripe de la vitrine et le
  provisioning vers l'application pour les contrats qu'elle a vendus.

Le retrait de tout le code de facturation de la vitrine (tables, crons, webhook, tunnel)
est un chantier séparé, à ouvrir quand ces parcours sont éteints et que le report des
contrats dans l'application a été vérifié.

## Le back-office ne porte plus la facturation

Depuis le 11 novembre 2026, la section « Facturation » du back-office de la vitrine
(tableau de bord, abonnements, souscriptions, accès offerts, incidents, mandats, factures,
synchro) est retirée. Le back-office se limite au site : contenu, pages, actualités,
collections, médias, demandes de contact, référencement, villes, utilisateurs, réglages,
journal d'audit. `/admin` mène au cockpit de contenu. Abonnements et accès offerts se suivent
dans la console du logiciel.

Seuls les écrans sont partis. Le code serveur de facturation (routes, crons, webhook Stripe,
tables) tourne toujours pour les parcours engagés, sans écran pour les suivre côté vitrine :
les alertes continuent d'arriver par email (`BILLING_ALERTS_TO`).

## Le jour de la bascule

1. Vérifier que l'application est en ligne avec le nouveau tunnel :
   `GET https://app.medicarepro.fr:3000/api/billing/offres` renvoie des montants
   (et non `No token provided`, réponse de l'ancien serveur), et
   `https://app.medicarepro.fr/register` affiche le choix de formule.
2. Poser `INSCRIPTION_DANS_APP=true` dans Coolify et déployer la vitrine
   (`bash .claude/deploy-coolify.sh`).
3. Contrôler : un bouton « S'inscrire » du site mène à `app.medicarepro.fr/register?plan=…` ;
   `https://medicarepro.fr/inscription` redirige.
4. Prévenir l'équipe : les accès offerts se créent désormais dans la console de l'application.

Retour arrière : `INSCRIPTION_DANS_APP=false` et redéploiement. Rien n'est détruit par la
bascule.

## Tests

`src/lib/appLinks.test.ts` couvre l'interrupteur et les deux destinations. Lancer
`npm test`.
