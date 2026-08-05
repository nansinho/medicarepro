-- ============================================================
-- 0036 — Le tunnel de vente passe sur Stripe.
--
-- Le dossier d'inscription (pending_signups) porte déjà l'identifiant de session
-- Stripe depuis la 0034. Il lui manque ce que le worker doit recopier sur le
-- contrat quand il le crée, des minutes ou des heures plus tard : l'abonnement,
-- le client, et l'échéance.
--
-- POURQUOI L'ÉCHÉANCE EST STOCKÉE ICI plutôt que recalculée au provisioning.
-- Chez Monetico, la période était dérivée de `monetico_order_date` faute de
-- mieux, et le décalage UTC/Paris a déjà produit une échéance fausse d'un jour
-- (MPB19GK81GC9 : 23/08 chez nous, 24/08 à la banque), affichant l'abonnement
-- comme expiré pendant 24 h. Stripe, lui, connaît sa date : on la conserve au
-- moment où on la reçoit, et le worker la recopie sans rien recalculer.
--
-- Ré-exécutable : `if not exists` partout, aucune valeur écrasée.
-- ============================================================

alter table public.pending_signups
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_current_period_end timestamptz;

comment on column public.pending_signups.stripe_current_period_end is
  'Échéance telle que Stripe la tient au moment du paiement. Fait autorité : le worker la recopie sur le contrat sans la recalculer.';

-- Une session de paiement n'appartient qu'à un dossier. Sans cette unicité, une
-- notification re-livrée pourrait marquer payé un second dossier de la même
-- chaîne de reprise, et le cabinet serait provisionné deux fois.
create unique index if not exists pending_signups_stripe_session_idx
  on public.pending_signups (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Même raisonnement sur l'abonnement : deux dossiers ne peuvent pas se réclamer
-- du même abonnement Stripe.
create unique index if not exists pending_signups_stripe_sub_idx
  on public.pending_signups (stripe_subscription_id)
  where stripe_subscription_id is not null;
