-- ============================================================================
-- 0015 — SEPA : mandats Core, échéancier de prélèvements, remises CIC,
--        tâches de synchro app (intérim sans endpoint renew côté dev B).
--
-- Conventions CIC signées le 10/07/2026 (SDD Core CV.01.04). Obligations :
-- mandat signé AVANT tout prélèvement, RUM unique, pré-notification ≥ 14 j
-- calendaires, caducité 36 mois sans présentation, conservation du mandat
-- 13 mois après le dernier débit (purge à +15 mois par marge).
-- IBAN chiffré AES-256-GCM côté application (AAD = RUM) ; jamais en clair.
-- Écritures : service-role uniquement. RLS en 0016.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RUM (Référence Unique de Mandat) : MP-AAAA-NNNN, compteur par année.
-- Réservée dès le checkout (affichée dans le texte du mandat consenti) ;
-- les trous de numérotation (abandons de checkout) sont assumés — le
-- registre des mandats fait foi.
-- ----------------------------------------------------------------------------

create table public.sepa_rum_counters (
  year       int primary key,
  last_value int not null default 0
);

create or replace function public.next_sepa_rum()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year  int := extract(year from (now() at time zone 'Europe/Paris'))::int;
  v_value int;
begin
  insert into public.sepa_rum_counters as c (year, last_value)
  values (v_year, 1)
  on conflict (year)
    do update set last_value = c.last_value + 1
  returning c.last_value into v_value;

  return format('MP-%s-%s', v_year, lpad(v_value::text, 4, '0'));
end;
$$;

comment on function public.next_sepa_rum() is
  'RUM suivante (MP-AAAA-NNNN), compteur annuel atomique.';

revoke all on function public.next_sepa_rum() from public, anon, authenticated;
grant execute on function public.next_sepa_rum() to service_role;

-- ----------------------------------------------------------------------------
-- sepa_mandates — registre des mandats (une ligne par mandat, RUM unique).
-- Dossier de preuve : texte consenti versionné + hashé, horodatage, IP/UA,
-- méthode de signature, PDF archivé (bucket privé 'sepa').
-- Purge (cron sepa-purge, last_debit_at + 15 mois, hors legal_hold) :
-- iban_encrypted, bic, signature_ip/ua, debtor_address, debtor_email → NULL ;
-- squelette conservé : RUM, nom, dates, statut, iban_last4.
-- ----------------------------------------------------------------------------

create table public.sepa_mandates (
  id                   uuid primary key default gen_random_uuid(),
  rum                  text not null unique,
  subscription_id      uuid not null references public.subscriptions (id) on delete restrict,
  status               text not null default 'draft'
                         check (status in (
                           'draft',   -- créé, consentement non finalisé (rattrapage)
                           'sent',    -- envoyé pour signature (page tokenisée)
                           'signed',  -- consenti (case cochée + dossier de preuve) — prélevable
                           'active',  -- au moins un prélèvement présenté
                           'revoked', -- révoqué par le débiteur → plus jamais prélevable
                           'lapsed'   -- caduc (36 mois sans présentation)
                         )),
  scheme               text not null default 'CORE' check (scheme in ('CORE', 'B2B')),
  account_holder       text not null,          -- titulaire du compte (peut différer du cabinet)
  debtor_name          text not null,
  debtor_email         citext,
  debtor_address       text,
  iban_encrypted       text,                   -- <keyId>:base64(iv||tag||ct), AAD = rum ; NULL après purge
  iban_last4           text not null,          -- affichage (•••• 1234)
  bic                  text,                   -- exigé seulement hors EEE
  mandate_text_version text not null,
  mandate_text_sha256  text not null,
  signed_at            timestamptz,
  signature_method     text check (signature_method in ('checkbox', 'token_page', 'paper')),
  signature_ip         text,
  signature_user_agent text,
  pdf_path             text,                   -- bucket privé 'sepa' (mandates/{rum}/…)
  pdf_sha256           text,
  last_debit_at        timestamptz,            -- dernier débit collecté (base de conservation)
  last_presented_at    timestamptz,            -- dernière présentation (collecté OU rejeté) — caducité 36 mois
  amended_at           timestamptz,            -- dernier amendement (mobilité bancaire, même RUM)
  revoked_at           timestamptz,
  legal_hold           boolean not null default false, -- litige en cours : bloque la purge
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.sepa_mandates is
  'Mandats de prélèvement SEPA (registre RUM + dossier de preuve). IBAN chiffré, purgé à +15 mois.';

-- Un seul mandat « vivant » par souscription.
create unique index sepa_mandates_one_live_per_subscription
  on public.sepa_mandates (subscription_id)
  where status in ('draft', 'sent', 'signed', 'active');

create index sepa_mandates_status_idx on public.sepa_mandates (status);
create index sepa_mandates_presented_idx on public.sepa_mandates (last_presented_at);

create trigger trg_sepa_mandates_updated_at
  before update on public.sepa_mandates
  for each row execute function public.set_updated_at();

-- FK différée de 0013 : la souscription pointe son mandat courant.
alter table public.subscriptions
  add constraint subscriptions_sepa_mandate_fk
  foreign key (sepa_mandate_id) references public.sepa_mandates (id) on delete set null;

-- ----------------------------------------------------------------------------
-- sepa_remittances — lots de remise déposés sur l'espace CIC (v1 : manuel).
-- Le fichier d'export (pain.008 ou CSV) est généré À LA VOLÉE (IBAN déchiffrés
-- en mémoire, jamais écrits en Storage) ; seul son sha256 est conservé pour
-- le contrôle au moment du dépôt.
-- ----------------------------------------------------------------------------

create table public.sepa_remittances (
  id                        uuid primary key default gen_random_uuid(),
  label                     text not null unique, -- MP-REM-AAAAMMJJ-N
  requested_collection_date date not null,
  status                    text not null default 'open'
                              check (status in (
                                'open',               -- en préparation (débits rattachés)
                                'exported',           -- fichier généré (sha256 figé)
                                'submitted',          -- déposée sur l'espace CIC
                                'settled',            -- tous débits soldés
                                'partially_rejected'  -- au moins un rejet
                              )),
  export_sha256             text,
  exported_at               timestamptz,
  submitted_at              timestamptz,
  submitted_by              uuid,  -- profiles.id (pas de FK : trace qui survit)
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.sepa_remittances is
  'Remises de prélèvements SEPA (dépôt manuel CIC en v1). Export à la volée, sha256 conservé.';

create trigger trg_sepa_remittances_updated_at
  before update on public.sepa_remittances
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- sepa_debits — échéancier : un débit par période de renouvellement.
-- Idempotence de planification : unique (subscription_id, covers_period_start).
-- Garde absolue au rattachement à une remise (cf. lib SEPA) : mandat
-- signed|active ET prenotified_at::date <= collection - 14 j ET < 36 mois.
-- ----------------------------------------------------------------------------

create table public.sepa_debits (
  id                   uuid primary key default gen_random_uuid(),
  subscription_id      uuid not null references public.subscriptions (id) on delete restrict,
  mandate_id           uuid not null references public.sepa_mandates (id) on delete restrict,
  remittance_id        uuid references public.sepa_remittances (id) on delete set null,
  end_to_end_id        text not null unique,  -- EndToEndId SEPA (trace bancaire)
  sequence_type        text not null default 'RCUR' check (sequence_type in ('FRST', 'RCUR')),
  amount_cents         int not null check (amount_cents > 0),
  currency             text not null default 'EUR',
  due_date             date not null,          -- date de collecte réelle (jour ouvré TARGET, cut-off CIC)
  covers_period_start  timestamptz not null,
  covers_period_end    timestamptz not null,
  status               text not null default 'scheduled'
                         check (status in (
                           'scheduled',   -- planifié (J-21)
                           'prenotified', -- pré-notification envoyée (J-16)
                           'submitted',   -- dans une remise déposée
                           'collected',   -- encaissé → prolonge la souscription
                           'rejected',    -- R-transaction → dunning
                           'refunded',    -- remboursé après collecte (8 sem. Core / 13 mois MD01)
                           'canceled'     -- annulé (révocation, résiliation…)
                         )),
  prenotified_at       timestamptz,
  prenotify_message_id text,                  -- preuve d'envoi (archivée aussi en audit_log)
  dunning_stage        int not null default 0, -- 0 = aucun rappel ; 1/2/3 = J+1/J+3/J+7
  reject_reason        text,
  collected_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (subscription_id, covers_period_start)
);

comment on table public.sepa_debits is
  'Échéancier des prélèvements SEPA (un débit par période, planifié à J-21).';

create index sepa_debits_status_due_idx on public.sepa_debits (status, due_date);
create index sepa_debits_remittance_idx on public.sepa_debits (remittance_id);
create index sepa_debits_mandate_idx on public.sepa_debits (mandate_id);

create trigger trg_sepa_debits_updated_at
  before update on public.sepa_debits
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- app_sync_tasks — maillon manuel vitrine → app tant que dev B n'expose pas
-- d'endpoint de renouvellement/suspension : chaque événement de facturation
-- qui doit se refléter dans l'app crée une tâche, traitée par un humain
-- (écran /admin/billing/synchro) puis marquée done.
-- ----------------------------------------------------------------------------

create table public.app_sync_tasks (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  kind            text not null check (kind in (
                    'renewal',          -- prolonger subscriptionExpiresAt côté app
                    'suspension',       -- suspendre l'accès (impayé J+14)
                    'reactivation',     -- réactiver après régularisation
                    'rollback_renewal'  -- annuler une prolongation (remboursement SEPA)
                  )),
  payload         jsonb not null default '{}'::jsonb, -- ex. { newExpiresAt, previousExpiresAt }
  status          text not null default 'pending'
                    check (status in ('pending', 'done', 'canceled')),
  created_at      timestamptz not null default now(),
  done_at         timestamptz,
  done_by         uuid  -- profiles.id (pas de FK)
);

comment on table public.app_sync_tasks is
  'Tâches de synchro manuelle vitrine → app (intérim sans endpoint renew côté app).';

create index app_sync_tasks_pending_idx
  on public.app_sync_tasks (status, created_at) where status = 'pending';
create index app_sync_tasks_subscription_idx on public.app_sync_tasks (subscription_id);

-- ----------------------------------------------------------------------------
-- Buckets Storage privés : PDF de mandats + factures.
-- Aucune policy storage.objects : accès service-role + URLs signées courtes.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('sepa', 'sepa', false), ('billing', 'billing', false)
on conflict (id) do nothing;
