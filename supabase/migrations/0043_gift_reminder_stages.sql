-- ============================================================================
-- Rappels d'accès offert : ouvrir les paliers J-14 et J-2.
--
-- Les accès offerts (0041) ont amené des rappels de fin de période à J-14, J-7
-- et J-2 (cron renewal-reminders), sans élargir la contrainte posée par 0032,
-- qui n'accepte que (30, 15, 7, 3, 0, -3, -7).
-- Le cron « réserve » chaque palier par un insert AVANT d'écrire : à J-14 et
-- J-2 l'insert était refusé (400), le cron passait au suivant, et aucun email
-- ne partait. Seul J-7 arrivait (constaté le 01/11/2026 : J-2 refusé
-- le 28/10 pour Claire Jolibois et Nathan Varon, journaux Kong).
-- ============================================================================

alter table public.subscription_reminders
  drop constraint if exists subscription_reminders_days_before_check;
alter table public.subscription_reminders
  add constraint subscription_reminders_days_before_check
  check (days_before in (30, 15, 14, 7, 3, 2, 0, -3, -7));

comment on column public.subscription_reminders.days_before is
  'Palier du rappel. Positif avant l''échéance (30/15/7/3/0 ; 14/7/2 pour un accès offert), négatif après (-3/-7) pour les validations en retard.';
