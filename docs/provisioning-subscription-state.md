# Cycle de vie de l'abonnement — contrat vitrine ↔ application

Remplace `provisioning-renewal.md` (1er août 2026), qui ne couvrait que la
reconduction. Rédigé le 4 août 2026. **Implémenté** dans le dépôt de
l'application, branche `billing/abonnement-cycle-de-vie`.

## Ce qui ne marchait pas

L'application calcule `subscriptionExpiresAt` **une seule fois**, au
provisioning, et ne la bouge plus. Les encaissements suivants se passent chez
la vitrine, et rien ne redescendait. Trois conséquences, toutes constatées :

1. un abonné mensuel affiche une échéance dépassée dès son deuxième mois ;
2. le cron `subscription-check.job.ts` alerte les super-admins sur cette date
   périmée, pour des cabinets parfaitement à jour ;
3. un cabinet qui utilise le logiciel gratuitement ne pouvait pas souscrire :
   `POST /provisioning/cabinet` répond 409 sur un cabinet existant, **après
   encaissement**.

Et rien n'était bloqué à l'expiration : le login ne teste que `cabinet.status`.

## 1. `POST /api/provisioning/subscription/state`

Une seule route pour tous les mouvements postérieurs à la création du compte :
souscription d'un cabinet existant, reconduction, changement de formule,
résiliation, suspension pour impayé.

```
Header : x-medicarepro-provision-authorization: <clé de provisioning existante>
```

```jsonc
{
  "idempotencyKey": "MPDCH3MYHJM9-r3", // unique PAR MOUVEMENT
  "cabinetId": "cmrg49kym001pizc12p1cnkg5",
  "status": "ACTIVE",                  // ACTIVE|PAST_DUE|SUSPENDED|CANCELED|EXPIRED
  "plan": "MONTHLY",                   // optionnel
  "periodEnd": "2026-09-12T00:00:00.000Z", // optionnel
  "paidAt": "2026-08-12T09:12:00.000Z",    // optionnel
  "amountCents": 2988,                 // optionnel
  "currency": "EUR",                   // optionnel
  "maxAssistants": 2,                  // optionnel
  "cancelAtPeriodEnd": false,          // optionnel
  "graceUntil": "2026-08-26T00:00:00.000Z" // optionnel
}
```

**`idempotencyKey` ne doit JAMAIS être la seule référence de transaction.** Le
TPE récurrent rejoue la même référence à chaque échéance, et `provisioningRef`
est déjà `@unique` et consommé par la souscription initiale. La vitrine émet
donc `<référence>-r3`, `<référence>-attach`, `<référence>-fail-2`. Côté
application, ces clés vivent dans une table dédiée, `subscription_events` :
c'est le « registre des paiements » que la documentation d'origine annonçait
comme prérequis (§8).

Effets sur le cabinet visé :

| Champ | Valeur |
| --- | --- |
| `subscriptionStatus` | `status` |
| `subscriptionExpiresAt` | `periodEnd`, **si postérieure** à la valeur connue |
| `subscriptionPlan` | `plan` si fourni |
| `maxAssistants` | `maxAssistants` si fourni |
| `cancelAtPeriodEnd` | si fourni |
| `subscriptionGraceUntil` | `graceUntil`, ou `null` |
| `lastPaymentAt`, `paymentProvider` | si `paidAt` fourni |
| `subscriptionNotifiedAt` | `null` (ré-arme les alertes du cron) |
| `subscriptionSyncedAt` | maintenant |

**L'échéance ne recule jamais.** Un événement arrivé dans le désordre (file
d'attente, re-présentation) ne peut pas retirer des jours déjà payés.

Réponses : `200` appliqué **ou déjà appliqué** ; `404` cabinet inconnu ;
`400` corps invalide ; `401` clé refusée. La vitrine ne rejoue pas sur
400/401/404 ; sur 5xx ou timeout elle retente une fois puis alerte son équipe —
l'argent est encaissé et la facture émise quoi qu'il arrive.

## 2. `GET /api/provisioning/cabinet?id=…` ou `?email=…`

Lecture pour réconciliation. Renvoie l'identité, l'abonnement et
l'administrateur du cabinet. **Aucune donnée patient.** Sans elle, la vitrine
n'a aucun moyen de retrouver un cabinet : la recherche par email n'existait que
derrière un JWT super-admin.

## 3. Espace abonnement : le sens de l'appel est inversé

Le praticien n'a ni compte ni mot de passe chez la vitrine, et la vitrine ne
sait pas qui est connecté dans le logiciel. C'est donc **l'application qui
demande l'ouverture** :

```
POST {BILLING_API_URL}/api/portal/session
Header : x-medicarepro-provision-authorization: <même clé>
{ "cabinetId": "...", "userId": "...", "cabinet": { name, email, address, city,
  postalCode, siretNumber, invoicePrefix, adminEmail, adminName, plan,
  maxAssistants } }
→ 200 { "success": true, "data": { "url": "...", "expiresAt": "..." } }
```

L'URL est **à usage unique et valable 15 minutes** : elle est faite pour une
redirection immédiate. L'identité transmise pré-remplit la facturation ; elle ne
détermine jamais le prix, qui reste calculé par la grille tarifaire de la
vitrine.

Côté application : bouton « Gérer mon abonnement » dans `SubscriptionCard`,
route `POST /api/cabinet/subscription/portal`, variable `BILLING_API_URL`. Sans
cette variable, le bouton est simplement masqué.

## 4. Impayé : bandeau puis lecture seule, jamais de coupure

Décision actée avec le client. `subscriptionStatus = SUSPENDED` fait passer
l'application en **lecture seule** : les écritures répondent `402`, les lectures
et les exports restent intacts, la connexion fonctionne normalement.

Ce sont des données de santé et elles appartiennent au praticien : un incident
de paiement ne justifie pas de l'empêcher de consulter le dossier du patient
qu'il a en face de lui.

Trois précisions qui comptent :

- `PAST_DUE` **ne bloque rien** : c'est la période de relance, l'accès reste
  entier. Seul `SUSPENDED`, posé par la vitrine à l'expiration du délai de
  grâce, restreint la saisie.
- `subscriptionStatus` à `NULL` **ne bloque rien** non plus. C'est l'état des
  cabinets créés à la main et de ceux qui utilisent le logiciel gratuitement :
  les suspendre d'office le jour d'un déploiement couperait des cabinets qui
  n'ont rien demandé. Leur suspension est une décision humaine, posée via la
  vitrine.
- Le contrôle est en **fail-open** : si la vérification elle-même échoue (base
  indisponible), l'écriture passe. Empêcher un praticien de saisir une
  consultation à cause d'une requête ratée serait pire que l'encaissement en
  retard qu'on cherche à récupérer.

## 5. Points à trancher avec l'équipe de l'application

1. **`PROMO_PROVISION_API_KEY` est optionnelle** dans le schéma d'environnement.
   Absente en production, l'application répond 401 à tous les appels de
   provisioning avec un simple avertissement dans les logs : panne silencieuse,
   comptes non créés après paiement. À rendre obligatoire au démarrage.
2. **`maxAssistants` est incohérent entre les chemins de création** : le
   provisioning pose `extraCollaborators` (donc **0** pour un abonné sans
   option), la création manuelle et l'approbation posent **5**. Or ce quota
   bloque la création des rôles `ASSISTANT` **et** `SECRETARY`. Conséquence :
   un cabinet qui paie sans collaborateur supplémentaire ne peut pas créer de
   secrétaire, alors qu'un cabinet gratuit en a cinq. C'est une décision
   commerciale, pas un correctif technique : rien n'a été modifié.
3. **`CollaboratorRequest`** : l'approbation d'une demande augmente
   `maxAssistants` en base sans rien notifier à la facturation. Des sièges sont
   donc accordés sans être facturés. À brancher dans un second temps.
