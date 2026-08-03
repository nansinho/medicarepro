# Remontée des reconductions vers l'application

Demande d'ajout à l'API de provisioning (contrat « API de Provisioning », dev B).
Rédigé le 1er août 2026. Une seule route, aucun changement de schéma.

## Le problème

Le tunnel d'achat de la vitrine appelle `POST /provisioning/cabinet` avec le plan
souscrit. L'application calcule alors, une fois pour toutes :

```
subscriptionExpiresAt = date d'achat + 1 mois (MONTHLY) ou + 1 an (ANNUAL)
```

Les reconductions, elles, sont encaissées par la vitrine (TPE Monetico
« Paiement Récurrent ») et prolongent `subscriptions.current_period_end` dans la
base de la vitrine. **Rien ne redescend vers l'application** : l'API de
provisioning n'expose que `check-availability` et `cabinet`.

Conséquences aujourd'hui :

1. `Cabinet.subscriptionExpiresAt` reste figé sur la date du premier achat. Un
   abonné mensuel affiche une échéance dépassée dès son deuxième mois.
2. Le cron quotidien `subscription-check.job.ts` alerte les super-admins à J-30,
   J-7 et J-2 sur cette date périmée : les alertes partent pour des cabinets
   parfaitement à jour.
3. Le praticien ne peut pas savoir dans son logiciel quand il sera prélevé. Nous
   affichons désormais son plan (Mensuel / Annuel) et son échéance dans
   Cabinet › Informations ; l'échéance n'est présentée comme « prochaine » que
   si elle est encore à venir, sinon elle est libellée « dernière échéance
   connue », faute de mieux.

## La route demandée

```
POST /api/provisioning/subscription/renewal
Header : x-medicarepro-provision-authorization: <clé de provisioning existante>
```

Corps :

```jsonc
{
  "idempotencyKey": "MPDCH3MYHJM9-r3", // référence Monetico + rang de l'échéance
  "cabinetId": "clx…",                 // celui renvoyé par POST /provisioning/cabinet
  "plan": "ANNUAL",                    // MONTHLY | ANNUAL
  "periodEnd": "2027-08-25T00:00:00.000Z", // nouvelle fin de période (ISO 8601)
  "paidAt": "2026-08-25T09:12:00.000Z",    // encaissement notifié par Monetico
  "amountCents": 23904,
  "currency": "EUR"
}
```

Effet attendu, côté cabinet identifié par `cabinetId` :

| Champ                    | Valeur                                              |
| ------------------------ | --------------------------------------------------- |
| `subscriptionExpiresAt`  | `periodEnd`                                          |
| `lastPaymentAt`          | `paidAt`                                             |
| `paymentProvider`        | `MONETICO`                                           |
| `subscriptionNotifiedAt` | `null` (ré-arme les alertes d'expiration du cron)    |
| `subscriptionPlan`       | `plan` (inchangé en pratique, sécurise un changement de formule) |

Réponses :

- `200` + `{ "success": true, "data": { "subscriptionExpiresAt": "…" } }` :
  appliqué, **ou déjà appliqué** (idempotent sur `idempotencyKey`, comme
  `POST /provisioning/cabinet` l'est sur la référence de transaction).
- `404` : `cabinetId` inconnu.
- `400` : corps invalide. `401` : clé refusée.

Nous ne rejouons pas sur `400/401/404`. Sur `5xx` ou timeout, nous retentons une
fois, puis nous alertons notre équipe : l'argent est encaissé et la facture
émise quoi qu'il arrive, seule la date d'affichage reste à rattraper à la main.

## Côté vitrine, c'est prêt

- `notifyRenewal()` dans [`src/lib/provisioning.ts`](../src/lib/provisioning.ts),
  même authentification et même enveloppe que les deux appels existants.
- Appelé par `finalizeRenewal()` dans
  [`src/lib/billing/renewals.ts`](../src/lib/billing/renewals.ts), juste avant
  le journal d'audit.
- **Inerte** tant que `PROVISIONING_RENEWAL_ENABLED` n'est pas passé à `true`
  dans l'environnement : l'appel n'est même pas tenté. À basculer le jour où la
  route est en ligne.

## Point à trancher avec dev B

L'application ne bloque rien à l'expiration : aucun contrôle de
`subscriptionExpiresAt` à la connexion. Une fois la date fiable, il faudra
décider ce qui se passe pour un cabinet réellement impayé (bandeau
d'avertissement, lecture seule, ou statu quo). À notre avis, un bandeau à partir
de J+1 et rien de plus : couper l'accès à un dossier de santé pour un incident de
paiement est disproportionné, et les données restent celles du praticien.
