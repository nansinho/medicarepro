-- ============================================================================
-- 0027 — Détection des échéances refusées (impayés) + colmatage RLS.
--
-- CONSTAT À L'ORIGINE DE CETTE MIGRATION : une échéance de reconduction
-- REFUSÉE (carte expirée, provision insuffisante, opposition) ne déclenchait
-- STRICTEMENT RIEN. Le code-retour 'Annulation' sur un dossier déjà
-- provisionné retombe en 'stale' dans record_monetico_ipn (0021:225-233) et la
-- route IPN l'ignore explicitement. Résultat : le client gardait son accès,
-- l'argent cessait d'entrer, personne n'était prévenu, et la seule trace était
-- une ligne dans ipn_events que personne ne lit.
--
-- Les statuts 'past_due' et 'suspended' existent dans le CHECK de 0013 depuis
-- le premier jour mais ne sont écrits NULLE PART. Cette migration leur donne
-- enfin les colonnes de suivi qui manquaient, sans rien changer au chemin
-- d'encaissement nominal.
--
-- Contient aussi deux colmatages :
--   - subscription_reminders était la SEULE table billing sans RLS ni revoke
--     (0025 s'arrête à l'index) : lisible par anon via PostgREST ;
--   - subscription_renewals n'avait pas de statut terminal pour un paiement
--     refusé : les dossiers restaient 'pending' indéfiniment.
--
-- Ré-exécutable (if not exists / drop constraint if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. subscriptions — suivi des impayés.
--
-- Trois notions distinctes, là où 'canceled' mélangeait tout :
--   dunning_*    : l'argent n'entre plus (fait technique, réversible).
--   grace_until  : jusqu'à quand l'accès reste plein malgré l'impayé.
--   last_failure_code : le code-retour bancaire exact du dernier refus.
-- ----------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists dunning_started_at    timestamptz,
  add column if not exists dunning_failure_count int not null default 0,
  add column if not exists last_failure_at       timestamptz,
  add column if not exists last_failure_code     text,
  add column if not exists grace_until           timestamptz;

comment on column public.subscriptions.dunning_started_at is
  'Premier refus de la série en cours (NULL = à jour). Remis à NULL dès qu''une échéance passe.';
comment on column public.subscriptions.dunning_failure_count is
  'Nombre de refus consécutifs depuis dunning_started_at.';
comment on column public.subscriptions.last_failure_code is
  'Code-retour Monetico du dernier refus (Annulation…), pour le diagnostic.';
comment on column public.subscriptions.grace_until is
  'Fin du délai de grâce : au-delà, l''accès peut être restreint côté application.';

-- File du futur cron de relance : les impayés, du plus ancien au plus récent.
create index if not exists subscriptions_dunning_idx
  on public.subscriptions (dunning_started_at)
  where dunning_started_at is not null;

-- ----------------------------------------------------------------------------
-- 2. subscription_renewals — statut terminal pour un paiement refusé.
--    Sans lui, un renouvellement annuel refusé restait 'pending' pour
--    toujours, et sa référence continuait de router chaque IPN.
-- ----------------------------------------------------------------------------

alter table public.subscription_renewals
  drop constraint if exists subscription_renewals_status_check;
alter table public.subscription_renewals
  add constraint subscription_renewals_status_check check (status in (
    'pending',         -- formulaire ouvert, en attente du paiement
    'paid',            -- IPN accepté
    'extended',        -- souscription prolongée (terminal, idempotent)
    'refused',         -- paiement refusé par la banque (terminal)
    'amount_mismatch'  -- montant encaissé ≠ attendu → manuel
  ));

-- ----------------------------------------------------------------------------
-- 3. subscription_reminders — RLS manquante (0025 s'arrêtait à l'index).
--    Même doctrine que 0014/0016 : anon et authenticated n'ont RIEN,
--    service_role contourne la RLS.
-- ----------------------------------------------------------------------------

alter table public.subscription_reminders enable row level security;
revoke all on table public.subscription_reminders from anon, authenticated;

-- Le back-office lit les rappels via serviceClient(), comme subscription_renewals.
comment on table public.subscription_reminders is
  'Rappels d''échéance envoyés (offre annuelle). Service-role uniquement (RLS sans policy).';
