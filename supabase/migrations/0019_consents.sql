-- ============================================================================
-- 0019 — Preuve de consentement contractuel (art. 5 des CGV v2.1).
--
-- Une ligne par acceptation de la case contractuelle unique du tunnel
-- (CGV + CGU + DPA + grille tarifaire, + prise de connaissance des
-- politiques de confidentialité et de cookies). Append-only, DURABLE :
-- survit aux purges/anonymisations de pending_signups tant que le contrat
-- existe (rétention : durée du contrat + 5 ans, prescription commerciale).
-- Seuls les enregistrements de chaînes JAMAIS payées et supprimées sont
-- purgés avec elles (cron purge-pending-signups).
--
-- Preuve = libellé exact affiché + snapshot {document, version, sha256}
-- des PDF officiels + horodatage serveur + identité + IP/UA.
-- Écritures : service-role uniquement. Lecture : admin (RLS pattern 0014).
-- ============================================================================

create table public.consent_records (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'contract_terms'
                     check (kind in ('contract_terms')),
  -- Chaîne de checkout (root_id de pending_signups ; pas de FK : la preuve
  -- doit survivre à la purge des dossiers).
  pending_root_id  uuid not null,
  -- Posé au provisioning (worker) : rattache la preuve au contrat durable.
  subscription_id  uuid,
  -- Libellé EXACT affiché à l'utilisateur au moment de l'acceptation.
  label_text       text not null,
  -- Snapshot des documents couverts : [{document, version, sha256}, …].
  documents        jsonb not null,
  -- Horodatage SERVEUR de l'acceptation.
  accepted_at      timestamptz not null,
  -- Identité du signataire (exigence de preuve : version, identité, date/heure).
  full_name        text not null,
  email            citext not null,
  client_ip        text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

comment on table public.consent_records is
  'Preuves de consentement contractuel (append-only, durable — art. 5 CGV).';

create index consent_records_root_idx on public.consent_records (pending_root_id);
create index consent_records_subscription_idx on public.consent_records (subscription_id);

-- ----------------------------------------------------------------------------
-- RLS : lecture admin uniquement, écritures service-role seul (pattern 0014).
-- ----------------------------------------------------------------------------

alter table public.consent_records enable row level security;

revoke all on table public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;

create policy consent_records_select_admin
  on public.consent_records for select using (public.is_admin());
