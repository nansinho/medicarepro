-- ============================================================
-- 0033 — La plateforme Monetico devient un fait de commande.
--
-- CE QUI S'EST PASSÉ LE 05/08/2026. Le cabinet EI a reçu une alerte
-- « URGENT — la reconduction est TOUJOURS ACTIVE, le client sera prélevé ».
-- C'était faux. Une sonde vers les deux plateformes l'a établi :
--
--   plateforme TEST  -> « paiement deja accepte », « la recurrence est deja stoppee »
--   plateforme PROD  -> « commande non authentifiee »
--
-- La commande vit sur la plateforme d'ESSAI, où sa reconduction est déjà
-- arrêtée, et on en demandait l'arrêt à la PRODUCTION. Les 7 abonnements
-- existants sont dans ce cas : tous payés en test (ipn_events.code_retour =
-- 'payetest'), alors que le site tourne désormais en production.
--
-- LA CAUSE. Une commande passée sur une plateforme n'existe pas sur l'autre,
-- et rien n'enregistrait laquelle. moneticoConfigForPlan() ne connaît que
-- MONETICO_MODE, c'est-à-dire la configuration d'AUJOURD'HUI, pas celle du jour
-- de la commande. Le numéro de TPE ne peut pas servir de substitut : il est
-- identique sur les deux plateformes (.env.example), et les lignes reprises par
-- la migration 0028 l'ont à NULL.
--
-- POURQUOI NULLABLE ET SANS DÉFAUT. L'erreur n'a pas le même prix dans les deux
-- sens. Étiqueter « test » une commande de production ferait sauter l'appel à la
-- banque : un client résilié continuerait d'être prélevé, avec un litige au
-- bout. Étiqueter « production » une commande de test ne produit qu'un refus et
-- une alerte inutile. NULL veut donc dire « inconnue », et l'appelant appelle la
-- banque quand même en le disant.
--
-- Ré-exécutable : à relancer sans dommage.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes
-- ------------------------------------------------------------

-- Porteuse : la commande est ce qui vit sur une plateforme.
alter table public.subscription_orders
  add column if not exists monetico_platform text;

-- Copie de la commande récurrente vivante. NON immuable : attach.ts repointe un
-- contrat existant sur une nouvelle commande, et une valeur figée à « test »
-- resterait fausse le jour où ce contrat repasse en production.
alter table public.subscriptions
  add column if not exists monetico_platform text;

-- Chaîne d'inscription : sa colonne code_retour survit à l'anonymisation à
-- 90 jours, c'est donc la seule preuve durable pour les dossiers du tunnel.
alter table public.pending_signups
  add column if not exists monetico_platform text;

-- Chaîne comptable, conservée 10 ans alors qu'ipn_events est purgé à 13 mois :
-- sans colonne ici, la dérivation à la volée cassera un jour, en silence.
alter table public.billing_ledger
  add column if not exists monetico_platform text;

-- Re-paiement d'un renouvellement annuel : c'est une commande bancaire de plus,
-- avec sa propre référence, donc sa propre plateforme.
alter table public.subscription_renewals
  add column if not exists monetico_platform text;

do $$
declare
  t text;
begin
  foreach t in array array[
    'subscription_orders', 'subscriptions', 'pending_signups', 'billing_ledger',
    'subscription_renewals'
  ] loop
    if not exists (
      select 1 from pg_constraint
       where conname = t || '_monetico_platform_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (monetico_platform in (''test'',''production''))',
        t, t || '_monetico_platform_check'
      );
    end if;
  end loop;
end;
$$;

comment on column public.subscription_orders.monetico_platform is
  'Plateforme Monetico sur laquelle cette commande a été passée. NULL = inconnue : appeler la banque quand même. Une commande ne déménage pas (trigger d''immuabilité).';
comment on column public.subscriptions.monetico_platform is
  'Copie de la plateforme de la commande récurrente vivante. Suit la commande, donc modifiable.';

-- ------------------------------------------------------------
-- 2. Remplissage depuis le seul fait observable
--
-- code_retour = 'payetest' n'existe que sur la plateforme d'essai ; 'paiement'
-- que sur celle de production. bool_or plutôt que min(case ...) : ce dernier
-- renverrait 'production' par simple ordre alphabétique si une référence portait
-- les deux codes.
-- ------------------------------------------------------------

with ev as (
  select reference,
         case when bool_or(code_retour = 'paiement') then 'production'
              when bool_or(code_retour = 'payetest') then 'test' end as p
    from public.ipn_events
   group by reference
)
update public.subscriptions s
   set monetico_platform = ev.p
  from ev
 where ev.reference = s.monetico_reference
   and ev.p is not null
   and s.monetico_platform is null;

with ev as (
  select reference,
         case when bool_or(code_retour = 'paiement') then 'production'
              when bool_or(code_retour = 'payetest') then 'test' end as p
    from public.ipn_events
   group by reference
)
update public.subscription_orders o
   set monetico_platform = ev.p
  from ev
 where ev.reference = o.monetico_reference
   and ev.p is not null
   and o.monetico_platform is null;

with ev as (
  select reference,
         case when bool_or(code_retour = 'paiement') then 'production'
              when bool_or(code_retour = 'payetest') then 'test' end as p
    from public.ipn_events
   group by reference
)
update public.billing_ledger l
   set monetico_platform = ev.p
  from ev
 where ev.reference = l.reference
   and ev.p is not null
   and l.monetico_platform is null;

with ev as (
  select reference,
         case when bool_or(code_retour = 'paiement') then 'production'
              when bool_or(code_retour = 'payetest') then 'test' end as p
    from public.ipn_events
   group by reference
)
update public.subscription_renewals r
   set monetico_platform = ev.p
  from ev
 where ev.reference = r.monetico_reference
   and ev.p is not null
   and r.monetico_platform is null;

-- pending_signups porte son propre code retour, qui survit à l'anonymisation.
update public.pending_signups
   set monetico_platform = case code_retour
         when 'payetest' then 'test'
         when 'paiement' then 'production' end
 where monetico_platform is null
   and code_retour in ('payetest', 'paiement');

-- ------------------------------------------------------------
-- 3. Correction de données — JAMAIS séparée du reste
--
-- Une reconduction qui vit sur la plateforme d'essai ne déplacera jamais un
-- centime : la déclarer active est un mensonge, et c'est ce mensonge qui fait
-- afficher « Prochain prélèvement » sur une date passée, qui bloque le bouton de
-- reprise, et qui empêche ces contrats d'expirer.
--
-- Cette seule écriture rouvre quatre portes : l'expiration (0032), les rappels
-- d'échéance, le paiement depuis l'espace, et le bouton de reprise. Chaque
-- contrat s'éteindra alors à sa propre échéance, sans qu'aucun email ne parte.
-- ------------------------------------------------------------

update public.subscriptions
   set recurrence_stopped_at = now(),
       current_recurring_order_id = null
 where recurrence_stopped_at is null
   and monetico_platform = 'test';

-- ------------------------------------------------------------
-- 4. Immuabilité : une commande ne change pas de plateforme
--
-- Sur subscriptions, au contraire, c'est une copie qui doit suivre la commande
-- récurrente vivante : pas de trigger là-bas.
-- ------------------------------------------------------------

create or replace function public.freeze_monetico_platform()
returns trigger
language plpgsql
as $$
begin
  if old.monetico_platform is not null
     and new.monetico_platform is distinct from old.monetico_platform then
    raise exception
      'monetico_platform est immuable (% -> %) : une commande ne change pas de plateforme.',
      old.monetico_platform, new.monetico_platform;
  end if;
  return new;
end;
$$;

comment on function public.freeze_monetico_platform() is
  'Refuse de modifier monetico_platform une fois posée. La plateforme est un fait de commande, constaté à l''émission.';

drop trigger if exists freeze_monetico_platform on public.subscription_orders;
create trigger freeze_monetico_platform
  before update on public.subscription_orders
  for each row execute function public.freeze_monetico_platform();

drop trigger if exists freeze_monetico_platform on public.pending_signups;
create trigger freeze_monetico_platform
  before update on public.pending_signups
  for each row execute function public.freeze_monetico_platform();

drop trigger if exists freeze_monetico_platform on public.billing_ledger;
create trigger freeze_monetico_platform
  before update on public.billing_ledger
  for each row execute function public.freeze_monetico_platform();

drop trigger if exists freeze_monetico_platform on public.subscription_renewals;
create trigger freeze_monetico_platform
  before update on public.subscription_renewals
  for each row execute function public.freeze_monetico_platform();

-- ------------------------------------------------------------
-- 5. Doctrine RLS du projet : service_role uniquement.
--    Les tables concernées l'ont déjà ; rien à ajouter ici, mais on le
--    reverrouille pour que cette migration reste vraie si elle est rejouée
--    sur une base reconstruite.
-- ------------------------------------------------------------

revoke all on function public.freeze_monetico_platform() from public, anon, authenticated;
