-- ============================================================================
-- 0011 — Système : audit_log (append-only) + job_runs (verrou + observabilité)
-- audit_log : INSERT via service-role uniquement (aucune policy d'écriture).
-- ============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,   -- pas de FK : l'entrée doit survivre à la suppression de l'utilisateur
  actor_email citext,
  action      text not null, -- ex. post.publish, settings.update, contact.status_change
  entity_type text,
  entity_id   text,
  diff        jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Runner de jobs : une seule exécution simultanée par job (index unique partiel).
-- ----------------------------------------------------------------------------

create table public.job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_name     text not null, -- publish-scheduled | gsc-sync | ai-article-generate | site-audit…
  status       text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  result       jsonb,
  error        text
);

-- Verrou : impossible de démarrer deux runs simultanés du même job.
create unique index job_runs_one_running_per_job
  on public.job_runs (job_name) where status = 'running';

create index job_runs_name_idx on public.job_runs (job_name, started_at desc);
create index job_runs_status_idx on public.job_runs (status, started_at desc);
