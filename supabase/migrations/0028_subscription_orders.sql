-- ============================================================================
-- 0028 — subscription_orders : séparer le CONTRAT du MOYEN DE PAIEMENT.
--
-- LE VERROU QU'ON FAIT SAUTER : depuis 0013, subscriptions.monetico_reference
-- est NOT NULL UNIQUE. Un abonnement ne peut donc porter qu'UNE commande
-- bancaire, pour toujours. Or Monetico n'expose ni alias, ni empreinte carte,
-- ni modification de commande récurrente : changer de carte, changer de
-- montant (collaborateur ajouté) ou changer de formule impose d'ARRÊTER la
-- commande et d'en OUVRIR UNE NOUVELLE, donc une nouvelle référence.
-- Tant que la référence vit dans subscriptions, aucun de ces gestes n'est
-- possible sans casser le lien avec tout l'historique comptable.
--
-- APRÈS : `subscriptions` = le contrat (droits, durée, statut, intention).
--         `subscription_orders` = les commandes bancaires successives.
-- Une seule commande récurrente peut être vivante à la fois (index unique
-- partiel) : c'est la garde structurelle contre le double prélèvement.
--
-- CE QUI NE CHANGE PAS : les lignes rétro-remplies portent kind='initial' et
-- restent traitées par record_monetico_ipn comme aujourd'hui. Le chemin
-- d'encaissement des abonnements existants n'est pas modifié par cette
-- migration.
--
-- Ré-exécutable, SAUF l'index d'unicité par cabinet : un pré-contrôle explicite
-- échoue avec la liste des doublons plutôt que de laisser passer une erreur
-- Postgres illisible.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La table.
-- ----------------------------------------------------------------------------

create table if not exists public.subscription_orders (
  id                  uuid primary key default gen_random_uuid(),

  -- NULL tant que le contrat n'existe pas : une souscription pour un cabinet
  -- existant ouvre sa commande AVANT d'avoir une ligne subscriptions.
  subscription_id     uuid references public.subscriptions (id) on delete set null,

  -- Cible dans l'application. Connue dès l'ouverture pour tout flux hors
  -- tunnel (le jeton d'entrée la porte), ce qui évite d'avoir à interroger
  -- l'app pour retrouver le cabinet.
  app_cabinet_id      text not null,
  app_user_id         text,

  kind                text not null check (kind in (
                        'initial',      -- 1re commande née du tunnel (rétro-remplie)
                        'attach',       -- cabinet existant SANS abonnement qui souscrit
                        'resubscribe',  -- abonnement expiré ou résilié qui repart
                        'card_update',  -- même formule, nouvelle carte
                        'plan_change'   -- changement de formule ou de sièges
                      )),

  -- La banque rejouera-t-elle cette commande toute seule ?
  -- 'recurring' = TPE récurrent (NB8179R) ; 'oneshot' = TPE immédiat (NB8179I).
  role                text not null check (role in ('recurring', 'oneshot')),

  plan                text not null check (plan in ('MONTHLY', 'ANNUAL')),
  extra_collaborators int  not null default 0 check (extra_collaborators between 0 and 20),
  amount_cents        int  not null check (amount_cents > 0),
  currency            text not null default 'EUR',

  monetico_reference  text not null unique
                        check (monetico_reference ~ '^[A-Z0-9]{12}$'),
  -- TPE réellement utilisé à l'émission (diagnostic). NULL sur les lignes
  -- rétro-remplies : on ne réécrit pas une histoire qu'on n'a pas observée.
  monetico_tpe        text,
  -- JJ/MM/AAAA figé à l'émission. La banque authentifie l'arrêt de récurrence
  -- et la mise en recouvrement dessus : une date fausse d'un jour = refus.
  monetico_order_date text,

  status              text not null default 'pending' check (status in (
                        'pending',         -- formulaire ouvert, paiement attendu
                        'paid',            -- IPN accepté, effets non encore appliqués
                        'applied',         -- effets appliqués au contrat (terminal)
                        'amount_mismatch', -- montant encaissé ≠ attendu → manuel
                        'expired',         -- ouverte puis abandonnée (purge)
                        'failed'           -- refusée par la banque (terminal)
                      )),

  -- Chaîne de remplacement : la commande que celle-ci remplace.
  supersedes_order_id uuid references public.subscription_orders (id) on delete set null,
  superseded_at       timestamptz,

  -- Identité de facturation figée à l'ouverture (nom, adresse, email admin…) :
  -- une commande doit pouvoir produire sa facture des mois plus tard.
  billing_snapshot    jsonb not null default '{}'::jsonb,
  consent_record_id   uuid,

  expires_at          timestamptz,
  paid_at             timestamptz,
  applied_at          timestamptz,
  client_ip           text,
  -- Ouverte depuis le back-office plutôt que par le client.
  created_by_admin    uuid,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.subscription_orders is
  'Commandes Monetico successives d''un abonnement (une seule récurrente vivante à la fois).';
comment on column public.subscription_orders.role is
  'recurring = la banque rejoue l''échéance seule (TPE NB8179R) ; oneshot = paiement unique (NB8179I).';
comment on column public.subscription_orders.kind is
  'initial = né du tunnel (traité par record_monetico_ipn) ; les autres passent par l''aiguillage applicatif.';

-- GARDE ANTI DOUBLE PRÉLÈVEMENT : deux commandes récurrentes vivantes sur le
-- même abonnement deviennent impossibles en base. Un changement de carte doit
-- donc marquer l'ancienne superseded AVANT d'appliquer la nouvelle.
create unique index if not exists subscription_orders_live_recurring_idx
  on public.subscription_orders (subscription_id)
  where role = 'recurring' and status = 'applied' and superseded_at is null;

create index if not exists subscription_orders_sub_idx
  on public.subscription_orders (subscription_id, created_at desc);
create index if not exists subscription_orders_cabinet_idx
  on public.subscription_orders (app_cabinet_id, created_at desc);
-- File de purge des commandes ouvertes jamais payées.
create index if not exists subscription_orders_pending_idx
  on public.subscription_orders (expires_at)
  where status = 'pending';

create or replace trigger trg_subscription_orders_updated_at
  before update on public.subscription_orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. subscriptions.current_recurring_order_id — LE fait bancaire.
--
-- NULL = aucune récurrence vivante côté banque. Ce champ remplace
-- recurrence_stopped_at comme source de vérité : ce dernier est posé D'OFFICE
-- à la création pour tout ANNUAL (worker.ts), il ne dit donc rien de l'état
-- réel d'un abonnement mensuel et ne peut pas servir d'axe.
-- ----------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists current_recurring_order_id uuid
    references public.subscription_orders (id) on delete set null;

comment on column public.subscriptions.current_recurring_order_id is
  'Commande récurrente actuellement vivante en banque. NULL = plus aucune reconduction attendue.';

-- ----------------------------------------------------------------------------
-- 3. Reprise de l'existant.
--    Une commande 'initial' par abonnement, avec sa référence et sa date.
--    MONTHLY → récurrente et vivante ; ANNUAL → paiement unique, donc aucune
--    commande récurrente courante.
-- ----------------------------------------------------------------------------

insert into public.subscription_orders (
  subscription_id, app_cabinet_id, app_user_id, kind, role, plan,
  extra_collaborators, amount_cents, currency, monetico_reference,
  monetico_order_date, status, paid_at, applied_at, created_at
)
select s.id, s.app_cabinet_id, s.app_user_id, 'initial',
       case when s.plan = 'MONTHLY' then 'recurring' else 'oneshot' end,
       s.plan, s.extra_collaborators, s.first_payment_cents, s.currency,
       s.monetico_reference, s.monetico_order_date, 'applied',
       s.started_at, s.started_at, s.created_at
  from public.subscriptions s
 where not exists (
         select 1 from public.subscription_orders o
          where o.monetico_reference = s.monetico_reference
       );

update public.subscriptions s
   set current_recurring_order_id = o.id
  from public.subscription_orders o
 where o.subscription_id = s.id
   and o.role = 'recurring'
   and o.status = 'applied'
   and o.superseded_at is null
   and s.current_recurring_order_id is null
   -- Un abonnement déjà résilié n'a plus de récurrence vivante.
   and s.recurrence_stopped_at is null
   and s.status <> 'canceled';

-- ----------------------------------------------------------------------------
-- 4. Un seul abonnement vivant par cabinet (cas « double abonnement »).
--    Pré-contrôle explicite : mieux vaut un message clair qu'une erreur
--    d'index incompréhensible six mois plus tard.
-- ----------------------------------------------------------------------------

do $$
declare
  v_dupes text;
begin
  select string_agg(app_cabinet_id, ', ')
    into v_dupes
    from (
      select app_cabinet_id
        from public.subscriptions
       where status in ('active', 'past_due', 'suspended', 'pending_mandate')
       group by app_cabinet_id
      having count(*) > 1
    ) d;

  if v_dupes is not null then
    raise exception
      'Doublons d''abonnement vivant sur le(s) cabinet(s) : %. Résoudre à la main (résilier ou fusionner) avant de rejouer cette migration.',
      v_dupes;
  end if;
end $$;

create unique index if not exists subscriptions_live_cabinet_idx
  on public.subscriptions (app_cabinet_id)
  where status in ('active', 'past_due', 'suspended', 'pending_mandate');

-- ----------------------------------------------------------------------------
-- 5. consent_records — rattachement à une COMMANDE.
--
-- La preuve de consentement était conçue pour le seul tunnel : pending_root_id
-- NOT NULL rattachait forcément la preuve à une chaîne de checkout. Une
-- souscription depuis l'espace abonnement n'en a pas — elle a une commande.
-- La contrainte tombe, une référence de commande la remplace. Aucun
-- consentement existant n'est touché.
-- ----------------------------------------------------------------------------

alter table public.consent_records
  alter column pending_root_id drop not null;
alter table public.consent_records
  add column if not exists subscription_order_id uuid;

comment on column public.consent_records.pending_root_id is
  'Chaîne de checkout à l''origine du consentement. NULL si la preuve vient d''une commande (subscription_order_id).';
comment on column public.consent_records.subscription_order_id is
  'Commande à l''origine du consentement (souscription depuis l''espace abonnement).';

create index if not exists consent_records_order_idx
  on public.consent_records (subscription_order_id)
  where subscription_order_id is not null;

-- ----------------------------------------------------------------------------
-- 6. RLS — doctrine 0014 : service-role uniquement.
-- ----------------------------------------------------------------------------

alter table public.subscription_orders enable row level security;
revoke all on table public.subscription_orders from anon, authenticated;
