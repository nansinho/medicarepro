-- ============================================================
-- PAIEMENT EN TROIS FOIS DE L'OFFRE 12 MOIS
--
-- Décidé le 06/08/2026. Le praticien règle 99,36 € à la signature, puis deux
-- fois le même montant aux deux mois suivants. Son accès court sur douze mois
-- dès le premier versement : il n'attend pas d'avoir tout payé pour travailler.
--
-- CE QUE STRIPE FAIT, ET CE QU'IL NE FAIT PAS. L'abonnement est ouvert avec une
-- « période d'essai » de douze mois : c'est le seul montage qui ne prélève rien
-- à l'ouverture (un ancrage de cycle facturait la première année EN PLUS du
-- versement, soit 397,41 € au lieu de 99,36 € — mesuré chez Stripe le
-- 06/08/2026). Au douzième mois, Stripe reprend la main et facture 298,08 €,
-- puis chaque année.
--
-- Les deux versements du milieu, eux, n'existent pour Stripe qu'au moment où on
-- les émet. C'est NOTRE calendrier qui les déclenche, et c'est pour ça que ces
-- colonnes existent : sans elles, personne ne réclamerait les deux tiers du prix.
--
-- POURQUOI LE CALENDRIER EST FIGÉ EN BASE plutôt que recalculé. Un montant
-- recalculé à chaque passage suivrait une grille tarifaire qui peut changer :
-- un praticien ayant signé à 99,36 € se verrait réclamer autre chose au
-- deuxième versement. Ce qui a été consenti est écrit une fois, et ne bouge plus.
-- ============================================================

alter table public.subscriptions
  add column if not exists instalment_total_count  smallint     not null default 0,
  add column if not exists instalment_paid_count   smallint     not null default 0,
  add column if not exists instalment_amounts_cents integer[]   not null default '{}',
  add column if not exists next_instalment_at      timestamptz,
  add column if not exists instalment_suspended_at timestamptz,
  add column if not exists instalment_last_error   text;

comment on column public.subscriptions.instalment_total_count is
  'Nombre de versements convenus (0 = paiement comptant). Ne change jamais après la signature.';
comment on column public.subscriptions.instalment_amounts_cents is
  'Montants TTC consentis, dans l''ordre. Leur somme vaut exactement le prix annuel.';
comment on column public.subscriptions.next_instalment_at is
  'Échéance du prochain versement à émettre. NULL quand tout est réglé.';
comment on column public.subscriptions.instalment_suspended_at is
  'Heure de passage en lecture seule sur versement refusé. NULL dès qu''il est réglé.';

-- Le cron balaie cette colonne toutes les heures : sans index il lirait toute
-- la table, et l'écrasante majorité des contrats n'est pas échelonnée.
create index if not exists subscriptions_next_instalment_idx
  on public.subscriptions (next_instalment_at)
  where next_instalment_at is not null;

-- Le choix fait dans le tunnel de vente, à reporter sur le contrat au moment où
-- le worker le crée. Sans lui, l'information se perdrait entre le paiement et
-- le provisioning, et le contrat naîtrait comptant.
alter table public.pending_signups
  add column if not exists instalment_count smallint not null default 0;

alter table public.subscription_orders
  add column if not exists instalment_count smallint not null default 0;

-- ============================================================
-- RÉSERVATION ATOMIQUE DES VERSEMENTS DUS
--
-- Le cron et le webhook peuvent tourner en même temps. Sans réservation, deux
-- passages concurrents émettraient DEUX factures pour le même versement, et le
-- praticien serait prélevé deux fois. `for update skip locked` garantit qu'une
-- ligne n'est remise qu'à un seul appelant.
--
-- On repousse l'échéance d'une heure AVANT même d'avoir facturé : si l'émission
-- échoue, la reprise aura lieu à l'heure suivante plutôt qu'en boucle immédiate.
-- ============================================================
create or replace function public.claim_due_instalments(p_limit integer default 20)
returns table (
  subscription_id uuid,
  stripe_subscription_id text,
  app_cabinet_id text,
  cabinet_name text,
  payment_reference text,
  instalment_index smallint,
  amount_cents integer,
  currency text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with due as (
    select s.id
      from public.subscriptions s
     where s.next_instalment_at is not null
       and s.next_instalment_at <= now()
       and s.instalment_paid_count < s.instalment_total_count
       and s.stripe_subscription_id is not null
       and s.status not in ('canceled', 'expired')
     order by s.next_instalment_at
     limit p_limit
       for update skip locked
  ),
  bumped as (
    update public.subscriptions s
       set next_instalment_at = now() + interval '1 hour'
      from due
     where s.id = due.id
    returning s.id, s.stripe_subscription_id, s.app_cabinet_id, s.cabinet_name,
              s.monetico_reference, s.instalment_paid_count,
              s.instalment_amounts_cents, s.currency
  )
  select b.id,
         b.stripe_subscription_id,
         b.app_cabinet_id,
         b.cabinet_name,
         b.monetico_reference,
         (b.instalment_paid_count + 1)::smallint,
         coalesce(b.instalment_amounts_cents[b.instalment_paid_count + 1], 0),
         b.currency
    from bumped b;
end;
$$;

comment on function public.claim_due_instalments(integer) is
  'Réserve les versements échus pour émission, en empêchant deux passages concurrents de facturer deux fois.';
