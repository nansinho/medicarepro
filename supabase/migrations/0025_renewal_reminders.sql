-- ============================================================================
-- 0025 — Rappels d'échéance pour l'offre annuelle (one-shot).
--
-- L'offre 12 mois est un paiement UNIQUE, sans reconduction carte : à
-- l'approche de l'échéance, il faut prévenir le client pour qu'il renouvelle,
-- sinon il perdrait son accès sans avertissement. Le cron
-- /api/cron/renewal-reminders envoie un rappel à J-30/15/7/3/0.
--
-- Cette table garantit qu'un même palier n'est envoyé qu'UNE fois par période :
-- la clé unique porte la date de fin de période, donc un renouvellement (qui
-- repousse period_end) réarme naturellement toute la série de rappels.
-- ============================================================================

create table if not exists public.subscription_reminders (
  id              bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  -- Fin de période visée par ce rappel (fige la série sur une échéance donnée).
  period_end      timestamptz not null,
  -- Palier : 30, 15, 7, 3 ou 0 jours avant l'échéance.
  days_before     int not null check (days_before in (30, 15, 7, 3, 0)),
  sent_at         timestamptz not null default now(),
  unique (subscription_id, period_end, days_before)
);

comment on table public.subscription_reminders is
  'Rappels d''échéance envoyés (offre annuelle). Un palier par (souscription, échéance).';

create index if not exists subscription_reminders_sub_idx
  on public.subscription_reminders (subscription_id);
