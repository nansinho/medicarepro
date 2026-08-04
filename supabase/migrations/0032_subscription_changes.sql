-- ============================================================================
-- 0032 — subscription_changes : les modifications d'abonnement demandées par
-- le praticien et honorées À L'ÉCHÉANCE.
--
-- POURQUOI UNE TABLE, ET PAS UN SIMPLE CHAMP SUR subscriptions :
--
-- Monetico ne sait pas modifier une commande récurrente en place — ni la
-- carte, ni le montant (cf. l'en-tête de src/lib/billing/orders.ts). Changer
-- de formule ou de carte impose donc d'ARRÊTER la commande en cours et d'en
-- ouvrir une nouvelle. Or une nouvelle commande récurrente encaisse un mois
-- plein immédiatement et remet le cycle à zéro : l'appliquer le jour de la
-- demande ferait perdre au client les jours qu'il a déjà payés.
--
-- D'où le modèle retenu : la demande est ENREGISTRÉE ici, la reconduction est
-- arrêtée tout de suite (accusé bancaire à l'appui), l'accès court jusqu'au
-- terme déjà réglé, et le client valide sa nouvelle formule par un paiement à
-- l'échéance. Personne ne perd d'argent, et l'état bancaire reste honnête :
-- on n'annonce jamais un prélèvement qui n'aura pas lieu.
--
-- CE QUE ÇA COÛTE, ET QU'IL FAUT ASSUMER : l'arrêt de récurrence est
-- IRRÉVERSIBLE côté banque. Un client qui se ravise (statut 'withdrawn') garde
-- sa formule, mais devra quand même valider un paiement à l'échéance : sa
-- reconduction automatique ne peut pas être ressuscitée. L'interface doit le
-- dire AVANT de déclencher l'appel bancaire.
--
-- La résiliation est du même bois : c'est une modification qui prend effet au
-- terme, sans paiement à honorer. Elle vit donc ici aussi, et pas dans un
-- mécanisme séparé.
-- ============================================================================

create table if not exists public.subscription_changes (
  id                  uuid primary key default gen_random_uuid(),

  subscription_id     uuid not null
                        references public.subscriptions (id) on delete cascade,
  -- Dupliqué depuis l'abonnement : les recherches du portail partent toujours
  -- du cabinet de la session, jamais de l'identifiant de souscription.
  app_cabinet_id      text not null,

  kind                text not null check (kind in (
                        'plan_change',  -- nouvelle formule et/ou nb de collaborateurs
                        'card_update',  -- même formule, nouvelle carte
                        'cancel'        -- pas de reconduction : fin au terme
                      )),

  -- Cible visée. Renseignée pour 'plan_change' seulement : un changement de
  -- carte reconduit la formule en cours, une résiliation n'en vise aucune.
  target_plan                text check (target_plan in ('MONTHLY', 'ANNUAL')),
  target_extra_collaborators int check (target_extra_collaborators between 0 and 20),
  -- Montant calculé par la grille tarifaire AU MOMENT DE LA DEMANDE, à seule
  -- fin d'affichage et de preuve de ce qui a été annoncé. Le montant qui part
  -- à la banque est recalculé à l'ouverture de la commande : un tarif qui
  -- bouge entre la demande et l'échéance ne doit pas se régler à l'ancien prix
  -- par le simple effet d'une valeur figée en base.
  target_amount_cents        int check (target_amount_cents > 0),

  status              text not null default 'scheduled' check (status in (
                        'scheduled',  -- en attente de l'échéance
                        'fulfilled',  -- honoré : la commande a été payée et appliquée
                        'withdrawn',  -- le client s'est ravisé
                        'lapsed'      -- l'échéance est passée sans paiement
                      )),

  -- Date à laquelle le changement devient payable : la fin de la période déjà
  -- réglée, telle que connue au moment de la demande.
  effective_at        timestamptz not null,

  -- Trace de l'appel bancaire d'arrêt de récurrence (libellé Monetico brut).
  -- NULL quand il n'y avait rien à arrêter : l'annuel est un paiement unique,
  -- sa reconduction est marquée arrêtée dès la souscription.
  recurrence_stop_lib text,

  -- Issue.
  fulfilled_order_id  uuid references public.subscription_orders (id) on delete set null,
  fulfilled_at        timestamptz,
  withdrawn_at        timestamptz,
  lapsed_at           timestamptz,

  -- Demande.
  requested_via       text not null default 'portal'
                        check (requested_via in ('portal', 'admin')),
  requested_by_admin  uuid,
  requested_ip        text,
  -- Motif de résiliation, saisi librement par le praticien. Facultatif : on ne
  -- retient personne en otage d'un formulaire.
  reason              text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Une formule visée n'a de sens que pour un changement de formule, et un
  -- changement de formule sans cible n'est pas honorable.
  constraint subscription_changes_target_coherent check (
    (kind = 'plan_change'
       and target_plan is not null
       and target_extra_collaborators is not null)
    or
    (kind <> 'plan_change'
       and target_plan is null
       and target_extra_collaborators is null)
  )
);

comment on table public.subscription_changes is
  'Modifications d''abonnement demandées par le praticien, honorées à l''échéance (Monetico ne sait pas modifier une commande récurrente en place).';
comment on column public.subscription_changes.effective_at is
  'Fin de la période déjà réglée : avant cette date, le changement n''est pas payable (le cycle bancaire repartirait du jour du paiement).';
comment on column public.subscription_changes.target_amount_cents is
  'Montant ANNONCÉ au client lors de la demande. Le montant encaissé est recalculé à l''ouverture de la commande.';
comment on column public.subscription_changes.recurrence_stop_lib is
  'Libellé renvoyé par la banque à l''arrêt de récurrence. NULL si aucune récurrence n''était en cours.';

-- UN SEUL changement en attente par abonnement. Deux demandes concurrentes
-- (deux onglets, un double clic) produiraient deux arrêts de récurrence et une
-- échéance impossible à honorer sans savoir laquelle honorer.
create unique index if not exists subscription_changes_one_pending_idx
  on public.subscription_changes (subscription_id)
  where status = 'scheduled';

-- File du cron : les changements arrivés à échéance et jamais honorés.
create index if not exists subscription_changes_due_idx
  on public.subscription_changes (effective_at)
  where status = 'scheduled';

create index if not exists subscription_changes_cabinet_idx
  on public.subscription_changes (app_cabinet_id, created_at desc);

drop trigger if exists subscription_changes_touch on public.subscription_changes;
create trigger subscription_changes_touch
  before update on public.subscription_changes
  for each row execute function public.set_updated_at();

-- Service-role uniquement (doctrine 0014) : rien de tout ceci ne se lit ni ne
-- s'écrit depuis un navigateur. Le portail passe par des routes serveur qui
-- vérifient d'abord le cookie de session.
alter table public.subscription_changes enable row level security;
revoke all on table public.subscription_changes from anon, authenticated;

-- ============================================================================
-- Rappels : ouvrir les paliers aux relances APRÈS l'échéance.
--
-- 0025 bornait `days_before` à (30, 15, 7, 3, 0) : des rappels d'anticipation,
-- pour une offre annuelle qu'on ne pouvait que renouveler à temps. Un
-- changement programmé, lui, peut rester non validé APRÈS son échéance — et
-- c'est précisément le moment où le praticien doit être relancé, pas celui où
-- l'on cesse de lui écrire. On ouvre donc J+3 et J+7, en réutilisant la même
-- table et la même unicité (un palier par échéance, jamais deux fois).
-- ============================================================================

alter table public.subscription_reminders
  drop constraint if exists subscription_reminders_days_before_check;
alter table public.subscription_reminders
  add constraint subscription_reminders_days_before_check
  check (days_before in (30, 15, 7, 3, 0, -3, -7));

comment on column public.subscription_reminders.days_before is
  'Palier du rappel. Positif avant l''échéance (30/15/7/3/0), négatif après (-3/-7) pour les validations en retard.';

-- ============================================================================
-- Rattrapage : marquer les abonnements dont la période est échue.
--
-- Rien, aujourd'hui, ne pose jamais le statut 'expired' — il est déclaré dans
-- la contrainte de 0013 et n'est écrit nulle part. Un abonnement annuel non
-- renouvelé reste donc 'active' indéfiniment, et le portail continue de
-- l'afficher comme un contrat en cours. Ça passait tant que la seule
-- conséquence était cosmétique ; ça ne passe plus dès lors qu'un changement
-- programmé doit être honoré, puis constaté non honoré.
--
-- La fonction est appelée par /api/cron/renewal-reminders (une fois par jour).
-- Elle est écrite ici pour rester au plus près de la contrainte de statut
-- qu'elle manipule.
-- ============================================================================

create or replace function public.expire_due_subscriptions(
  p_grace_days int default 14
)
returns table (subscription_id uuid, new_status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with due as (
    select s.id,
           s.status,
           s.current_period_end,
           s.grace_until
    from public.subscriptions s
    where s.status in ('active', 'past_due')
      -- Une reconduction carte vivante encaissera toute seule : ce n'est pas
      -- à ce cron de décréter l'échéance manquée à la place de la banque.
      and s.recurrence_stopped_at is not null
      and s.current_period_end < now()
  ),
  moved as (
    update public.subscriptions s
       set status = case
             when d.status = 'active' then 'past_due'
             when now() >= coalesce(d.grace_until,
                                    d.current_period_end + make_interval(days => p_grace_days))
               then 'expired'
             else 'past_due'
           end,
           grace_until = coalesce(
             s.grace_until,
             d.current_period_end + make_interval(days => p_grace_days)
           )
      from due d
     where s.id = d.id
       and (d.status = 'active'
            or now() >= coalesce(d.grace_until,
                                 d.current_period_end + make_interval(days => p_grace_days)))
    returning s.id, s.status
  )
  select m.id, m.status from moved m;
end;
$$;

comment on function public.expire_due_subscriptions(int) is
  'Fait passer en past_due, puis en expired après le délai de grâce, les abonnements sans reconduction dont la période est échue. Appelée par le cron quotidien.';

revoke all on function public.expire_due_subscriptions(int) from public, anon, authenticated;
grant execute on function public.expire_due_subscriptions(int) to service_role;
