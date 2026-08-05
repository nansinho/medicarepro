-- ============================================================
-- 0034 — Stripe : le prestataire cesse d'être implicite.
--
-- POURQUOI CE LOT. Le 05/08/2026, aucun paiement réel n'avait jamais abouti :
-- le TPE Monetico « Paiement Récurrent » n'authentifie pas en 3D Secure
-- (doc §1.5.3 et §1.5.4), et depuis la DSP2 les émetteurs français refusent le
-- non-authentifié. Le client passe sur Stripe.
--
-- CE QUI EST RENOMMÉ, ET POURQUOI PLUTÔT QUE DOUBLÉ. `monetico_platform`, posée
-- le matin même par la migration 0033, répond à une question qui n'a rien de
-- propre à Monetico : « sur quel monde cette commande vit-elle, l'essai ou le
-- réel ». Stripe a rigoureusement le même piège, avec ses clés sk_test_ et
-- sk_live_. Ajouter une seconde colonne au même sens obligerait à les écrire
-- toutes les deux, et la première divergence serait invisible. On renomme donc :
-- un concept, un nom, `payment_environment`.
--
-- CE QUI N'EST PAS RENOMMÉ. `monetico_reference` reste, et reste NOT NULL sur
-- les contrats. Ce n'est pas un oubli : la référence « MP + 10 caractères » que
-- nous produisons devient le `client_reference_id` de la session Stripe. Elle
-- continue donc d'exister, et avec elle toute la chaîne qui s'y adosse — clé
-- d'idempotence du provisioning, AAD de chiffrement des mots de passe, clé du
-- journal comptable, et la ligne « référence de paiement » imprimée sur chaque
-- facture. La renommer coûterait beaucoup pour ne rien changer.
--
-- Ré-exécutable.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Retirer d'abord le trigger de la 0033
--
-- Il se déclenche sur chaque UPDATE et lit `old.monetico_platform`. Le laisser
-- en place pendant le renommage le ferait échouer sur une colonne disparue, au
-- beau milieu de la migration.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'subscription_orders', 'pending_signups', 'billing_ledger', 'subscription_renewals'
  ] loop
    execute format('drop trigger if exists freeze_monetico_platform on public.%I', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 1. L'environnement de paiement, débaptisé de son prestataire
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'subscription_orders', 'subscriptions', 'pending_signups', 'billing_ledger',
    'subscription_renewals'
  ] loop
    -- Renommage seulement si l'ancienne existe et la nouvelle pas encore.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t
         and column_name = 'monetico_platform'
    ) and not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t
         and column_name = 'payment_environment'
    ) then
      execute format(
        'alter table public.%I rename column monetico_platform to payment_environment', t
      );
      execute format(
        'alter table public.%I rename constraint %I to %I',
        t, t || '_monetico_platform_check', t || '_payment_environment_check'
      );
    end if;

    -- Filet pour une base reconstruite depuis zéro : la colonne peut manquer.
    execute format(
      'alter table public.%I add column if not exists payment_environment text', t
    );
    if not exists (
      select 1 from pg_constraint where conname = t || '_payment_environment_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (payment_environment in (''test'',''production''))',
        t, t || '_payment_environment_check'
      );
    end if;

    -- Quel prestataire a encaissé. NULL = les lignes antérieures à ce lot,
    -- toutes Monetico par construction : on le pose explicitement plus bas.
    execute format(
      'alter table public.%I add column if not exists payment_provider text', t
    );
    if not exists (
      select 1 from pg_constraint where conname = t || '_payment_provider_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (payment_provider in (''monetico'',''stripe''))',
        t, t || '_payment_provider_check'
      );
    end if;
  end loop;
end;
$$;

comment on column public.subscription_orders.payment_environment is
  'Monde où vit la commande : essai ou réel. NULL = inconnue, l''appelant interroge le prestataire quand même. Une commande ne déménage pas (trigger d''immuabilité).';
comment on column public.subscription_orders.payment_provider is
  'Prestataire qui a encaissé cette commande. Immuable une fois posé.';

-- Tout ce qui existait avant ce lot a été encaissé par Monetico.
update public.subscription_orders   set payment_provider = 'monetico' where payment_provider is null;
update public.subscriptions         set payment_provider = 'monetico' where payment_provider is null;
update public.pending_signups       set payment_provider = 'monetico' where payment_provider is null;
update public.billing_ledger        set payment_provider = 'monetico' where payment_provider is null;
update public.subscription_renewals set payment_provider = 'monetico' where payment_provider is null;

-- ------------------------------------------------------------
-- 2. Le trigger d'immuabilité suit le renommage
--
-- Même règle qu'en 0033 : une commande ne change ni de monde ni de
-- prestataire. Toujours PAS sur `subscriptions`, où ces colonnes sont une
-- copie qui doit suivre la commande vivante.
-- ------------------------------------------------------------

create or replace function public.freeze_payment_origin()
returns trigger
language plpgsql
as $$
begin
  if old.payment_environment is not null
     and new.payment_environment is distinct from old.payment_environment then
    raise exception
      'payment_environment est immuable (% -> %) : une commande ne change pas de monde.',
      old.payment_environment, new.payment_environment;
  end if;
  if old.payment_provider is not null
     and new.payment_provider is distinct from old.payment_provider then
    raise exception
      'payment_provider est immuable (% -> %) : une commande ne change pas de prestataire.',
      old.payment_provider, new.payment_provider;
  end if;
  return new;
end;
$$;

comment on function public.freeze_payment_origin() is
  'Refuse de modifier l''origine d''un encaissement une fois constatée. Successeur de freeze_monetico_platform (0033).';

do $$
declare
  t text;
begin
  foreach t in array array[
    'subscription_orders', 'pending_signups', 'billing_ledger', 'subscription_renewals'
  ] loop
    execute format('drop trigger if exists freeze_monetico_platform on public.%I', t);
    execute format('drop trigger if exists freeze_payment_origin on public.%I', t);
    execute format(
      'create trigger freeze_payment_origin before update on public.%I
         for each row execute function public.freeze_payment_origin()', t
    );
  end loop;
end;
$$;

drop function if exists public.freeze_monetico_platform();

-- ------------------------------------------------------------
-- 3. Les identifiants Stripe, à côté des nôtres
--
-- Notre référence reste la clé de corrélation ; ceux-ci servent à retrouver
-- l'objet chez le prestataire, et à agir dessus (résilier, changer de formule).
-- ------------------------------------------------------------

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.subscription_orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_subscription_id text;

alter table public.pending_signups
  add column if not exists stripe_checkout_session_id text;

alter table public.billing_ledger
  add column if not exists stripe_invoice_id text;

alter table public.invoices
  add column if not exists stripe_invoice_id text,
  -- Stripe héberge le PDF : on garde l'URL plutôt que d'archiver un double.
  add column if not exists hosted_invoice_url text;

-- Un abonnement Stripe ne peut appartenir qu'à un seul contrat.
create unique index if not exists subscriptions_stripe_sub_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists subscription_orders_stripe_session_idx
  on public.subscription_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists invoices_stripe_invoice_idx
  on public.invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- ------------------------------------------------------------
-- 4. Journal des notifications Stripe
--
-- Même rôle qu'`ipn_events`, et même raison d'être : Stripe RE-LIVRE ses
-- événements, plusieurs fois s'il le faut, jusqu'à recevoir un 2xx. Sans clé
-- d'unicité, un `invoice.paid` rejoué prolongerait deux fois la période d'un
-- client. L'unicité porte sur `event.id`, que Stripe garantit stable.
--
-- On journalise AVANT d'agir. L'ordre inverse a déjà coûté cher le 04/08/2026 :
-- un renouvellement était aiguillé avant d'être enregistré, et n'entrait donc
-- jamais dans le journal — ni trace, ni idempotence.
-- ------------------------------------------------------------

create table if not exists public.stripe_events (
  id bigint generated always as identity primary key,
  -- `evt_…`, stable et unique chez Stripe : c'est la garde anti-rejeu.
  event_id text not null unique,
  type text not null,
  -- Le monde d'où vient l'événement. Une notification d'essai ne doit JAMAIS
  -- muter un contrat réel, et inversement.
  livemode boolean not null,
  -- Notre référence, quand l'objet la porte (client_reference_id, metadata).
  reference text,
  stripe_object_id text,
  amount_cents integer,
  currency text,
  -- Charge utile filtrée : jamais de donnée carte, jamais de secret.
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  -- Renseigné quand les effets métier ont été appliqués. Un événement reçu mais
  -- non traité reste visible, au lieu de disparaître dans un acquittement.
  processed_at timestamptz,
  process_error text
);

comment on table public.stripe_events is
  'Journal des notifications Stripe. event_id unique = garde anti-rejeu : Stripe re-livre jusqu''à recevoir un 2xx.';

create index if not exists stripe_events_reference_idx
  on public.stripe_events (reference)
  where reference is not null;

create index if not exists stripe_events_unprocessed_idx
  on public.stripe_events (received_at)
  where processed_at is null;

-- Doctrine du projet : service_role écrit, admin lit, personne d'autre.
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;
grant select on public.stripe_events to service_role;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'stripe_events'
         and policyname = 'stripe_events_admin_read'
    ) then
      create policy stripe_events_admin_read on public.stripe_events
        for select to authenticated using (public.is_admin());
    end if;
  end if;
end;
$$;

revoke all on function public.freeze_payment_origin() from public, anon, authenticated;
