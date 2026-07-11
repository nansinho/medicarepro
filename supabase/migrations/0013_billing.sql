-- ============================================================================
-- 0013 — Billing : tunnel d'inscription payante (Monetico) + provisioning app
--
-- La vitrine encaisse le 1er paiement par carte (Monetico classique, one-shot)
-- puis crée le compte dans l'app via son API de provisioning (contrat dev B).
-- Tables :
--   pending_signups : dossiers de checkout (chaîne de retry root_id/parent_id),
--                     secrets chiffrés AES-256-GCM côté application
--                     (password_enc, sepa_payload_enc — jamais en clair).
--   ipn_events      : journal append-only des notifications Monetico
--                     (idempotence par (provider, provider_event_id)).
--   subscriptions   : registre durable de facturation (source de vérité vitrine).
--   billing_ledger  : journal comptable append-only (10 ans, survit aux purges).
--   invoices        : factures B2B obligatoires (art. 289 CGI), numérotation
--                     annuelle verrouillée MP-F-AAAA-NNNN.
-- Écritures : service-role UNIQUEMENT (routes API server-only). RLS en 0014.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pending_signups — un dossier par tentative de checkout.
-- Chaîne de retry : root_id = id du premier dossier de la chaîne (hérité),
-- parent_id = dossier remplacé. Un retry crée une NOUVELLE ligne (nouvelle
-- référence Monetico), l'ancienne passe en 'superseded'.
-- ----------------------------------------------------------------------------

create table public.pending_signups (
  id                   uuid primary key default gen_random_uuid(),
  root_id              uuid not null,  -- = id à la création ; hérité au retry (pas de FK : self-ref au même statement)
  parent_id            uuid references public.pending_signups (id) on delete set null,
  monetico_reference   text not null unique
                         check (monetico_reference ~ '^[A-Z0-9]{12}$'),
  status               text not null default 'payment_pending'
                         check (status in (
                           'payment_pending', -- créé, en attente du paiement carte
                           'paid',            -- IPN accepté, en attente de provisioning
                           'provisioning',    -- claim posé par le worker (exclusif)
                           'provisioned',     -- compte créé dans l'app
                           'failed_conflict', -- 409 dev B après paiement → manuel, jamais rejoué
                           'amount_mismatch', -- montant IPN ≠ attendu → manuel, jamais provisionné
                           'duplicate_paid',  -- 2e paiement d'une même chaîne → remboursement manuel
                           'superseded',      -- remplacé par un retry
                           'abandoned'        -- purgé (jamais payé) ou remboursé
                         )),
  plan                 text not null check (plan in ('MONTHLY', 'ANNUAL')),
  extra_collaborators  int not null default 0
                         check (extra_collaborators between 0 and 20),
  amount_cents         int not null check (amount_cents > 0),
  currency             text not null default 'EUR',
  cabinet              jsonb not null, -- payload cabinet du contrat dev B (name, email, phone…)
  user_info            jsonb not null, -- firstName/lastName/email — JAMAIS le mot de passe
  invoice_prefix       text not null,
  password_enc         text,           -- <keyId>:base64(iv||tag||ct), AAD = monetico_reference
  sepa_payload_enc     text,           -- {iban,bic,accountHolder,consentAt,…}, même contrat crypto
  reserved_rum         text unique,    -- RUM tiré au checkout (next_sepa_rum, 0015)
  mandate_text_version text not null,
  mandate_text_sha256  text not null,
  cgv_accepted_at      timestamptz not null,
  mandate_accepted_at  timestamptz not null,
  client_ip            text,           -- purgé à 90 j (cron purge-pending-signups)
  user_agent           text,
  status_token         text not null,  -- secret du cookie de suivi (jamais exposé en SELECT, cf. 0014)
  paid_at              timestamptz,
  code_retour          text,           -- dernier code-retour Monetico reçu (paiement/payetest/Annulation)
  provisioned_at       timestamptz,
  app_cabinet_id       text,
  app_user_id          text,
  login_url            text,
  provision_attempts   int not null default 0,
  next_retry_at        timestamptz,
  last_error           text,           -- diagnostic technique — jamais de données sensibles
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.pending_signups is
  'Dossiers de checkout (inscription payante). Secrets chiffrés côté app, effacés après provisioning.';

-- Réservation locale du préfixe de facturation : un seul dossier « vivant »
-- par préfixe (anti-course entre deux checkouts simultanés du même cabinet).
create unique index pending_signups_prefix_live_idx
  on public.pending_signups (invoice_prefix)
  where status not in ('abandoned', 'superseded');

-- File du worker de provisioning (claim par le cron provision-retry).
create index pending_signups_retry_idx
  on public.pending_signups (next_retry_at)
  where status = 'paid';

create index pending_signups_root_idx on public.pending_signups (root_id);
create index pending_signups_status_idx on public.pending_signups (status, created_at desc);

create trigger trg_pending_signups_updated_at
  before update on public.pending_signups
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- ipn_events — journal append-only des notifications Monetico.
-- Idempotence : (provider, provider_event_id = reference || ':' || code_retour).
-- `raw` est FILTRÉ À L'INGESTION (jamais de MAC, bincb, hpancb, cbmasquee,
-- ipclient, numauto, authentification…). Purge > 13 mois (cron).
-- ----------------------------------------------------------------------------

create table public.ipn_events (
  id                bigint generated always as identity primary key,
  provider          text not null default 'monetico',
  provider_event_id text not null,
  reference         text not null,
  code_retour       text not null,
  amount_cents      int,
  currency          text,
  raw               jsonb not null,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);

comment on table public.ipn_events is
  'Notifications de paiement (append-only, raw filtré à l''ingestion, purge 13 mois).';

create index ipn_events_reference_idx on public.ipn_events (reference, received_at desc);
create index ipn_events_received_idx on public.ipn_events (received_at);

-- ----------------------------------------------------------------------------
-- record_monetico_ipn — traitement transactionnel d'une notification IPN.
-- Appelée par la route /api/monetico/ipn APRÈS vérification du MAC (le MAC
-- est la garde d'authenticité ; ici on ne traite que la logique métier).
-- Une seule transaction : journal + transition d'état + garde montant.
-- Retours :
--   'replay'            IPN déjà traité (même référence + même code) → ACK sans effet
--   'unknown_reference' référence inconnue → ACK + alerte applicative
--   'amount_mismatch'   montant/devise ≠ attendu → ACK + alerte, JAMAIS provisionné
--   'paid'              paiement accepté sur un dossier en attente
--   'paid_superseded'   paiement tardif sur un dossier remplacé (garde de chaîne côté worker)
--   'refused'           refus (Annulation) sur un dossier en attente
--   'stale'             événement métier obsolète (dossier déjà avancé) → ACK sans effet
--   'ignored'           code-retour hors périmètre (journalisé, aucun effet)
-- ----------------------------------------------------------------------------

create or replace function public.record_monetico_ipn(
  p_reference    text,
  p_code_retour  text,
  p_amount_cents int,
  p_currency     text,
  p_raw          jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_row   public.pending_signups%rowtype;
begin
  -- 1. Journal idempotent : un même événement (référence + code) n'est traité qu'une fois.
  insert into public.ipn_events
    (provider, provider_event_id, reference, code_retour, amount_cents, currency, raw)
  values
    ('monetico', p_reference || ':' || p_code_retour, p_reference, p_code_retour,
     p_amount_cents, p_currency, p_raw)
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    return 'replay';
  end if;

  -- 2. Paiement accepté (payetest = environnement de test, paiement = production).
  if p_code_retour in ('paiement', 'payetest') then
    select * into v_row
      from public.pending_signups
     where monetico_reference = p_reference
       for update;

    if not found then
      return 'unknown_reference';
    end if;

    if v_row.status in ('payment_pending', 'superseded') then
      -- Garde montant/devise : l'argent encaissé doit être exactement l'attendu.
      if v_row.amount_cents is distinct from p_amount_cents
         or v_row.currency is distinct from coalesce(p_currency, v_row.currency) then
        update public.pending_signups
           set status = 'amount_mismatch', code_retour = p_code_retour, paid_at = now()
         where id = v_row.id;
        return 'amount_mismatch';
      end if;

      update public.pending_signups
         set status = 'paid', code_retour = p_code_retour,
             paid_at = now(), next_retry_at = now()
       where id = v_row.id;

      return case when v_row.status = 'superseded' then 'paid_superseded' else 'paid' end;
    end if;

    -- Dossier déjà payé/provisionné : rejeu métier (référence identique, code différent).
    return 'stale';
  end if;

  -- 3. Refus de paiement.
  if p_code_retour = 'Annulation' then
    update public.pending_signups
       set code_retour = p_code_retour
     where monetico_reference = p_reference
       and status = 'payment_pending';

    get diagnostics v_count = row_count;
    return case when v_count > 0 then 'refused' else 'stale' end;
  end if;

  -- 4. Codes hors périmètre (paiement_pf2…, filtrage…) : journalisés, sans effet.
  return 'ignored';
end;
$$;

comment on function public.record_monetico_ipn(text, text, int, text, jsonb) is
  'Traite une notification Monetico (MAC déjà vérifié) : journal idempotent + transition + garde montant.';

revoke all on function public.record_monetico_ipn(text, text, int, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_monetico_ipn(text, text, int, text, jsonb)
  to service_role;

-- ----------------------------------------------------------------------------
-- subscriptions — registre durable de facturation (une ligne par souscription).
-- Créée par le worker au succès du provisioning. current_period_end est LE
-- champ de période (prolongé à chaque prélèvement SEPA collecté).
-- ----------------------------------------------------------------------------

create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  pending_signup_id    uuid references public.pending_signups (id) on delete set null,
  app_cabinet_id       text not null,
  app_user_id          text not null,
  cabinet_name         text not null,
  cabinet_email        citext not null,
  admin_email          citext not null,
  admin_name           text not null,
  invoice_prefix       text not null,
  plan                 text not null check (plan in ('MONTHLY', 'ANNUAL')),
  extra_collaborators  int not null default 0,
  first_payment_cents  int not null,
  renewal_amount_cents int not null,  -- source unique du montant de renouvellement (snapshot)
  currency             text not null default 'EUR',
  status               text not null default 'active'
                         check (status in (
                           'active',          -- à jour
                           'pending_mandate', -- provisionné mais mandat SEPA à rattraper
                           'past_due',        -- prélèvement rejeté, relances en cours
                           'suspended',       -- impayé au-delà de la grâce (J+14)
                           'canceled',        -- résilié
                           'expired'          -- terme atteint sans renouvellement
                         )),
  started_at           timestamptz not null,
  current_period_end   timestamptz not null,
  monetico_reference   text not null unique,
  sepa_mandate_id      uuid,  -- FK posée en 0015 (sepa_mandates n'existe pas encore)
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.subscriptions is
  'Registre de facturation vitrine (source de vérité des abonnements côté billing).';

create index subscriptions_status_idx on public.subscriptions (status, current_period_end);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);
create index subscriptions_cabinet_email_idx on public.subscriptions (cabinet_email);

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- billing_ledger — journal comptable append-only (10 ans, survit aux purges).
-- Chaque mouvement d'argent y laisse une trace minimale mais suffisante
-- (pièce comptable) séparée des identifiants nominatifs purgeables.
-- ----------------------------------------------------------------------------

create table public.billing_ledger (
  id              bigint generated always as identity primary key,
  event_type      text not null check (event_type in (
                    'card_payment',     -- 1er paiement Monetico
                    'card_refund',      -- remboursement carte (manuel CIC)
                    'sdd_collected',    -- prélèvement SEPA collecté
                    'sdd_rejected',     -- prélèvement rejeté (R-transaction)
                    'sdd_refunded',     -- remboursement SEPA (8 sem. Core / 13 mois MD01)
                    'rtransaction_fee'  -- frais bancaires refacturés
                  )),
  amount_cents    int not null,
  currency        text not null default 'EUR',
  occurred_at     timestamptz not null,
  reference       text not null,  -- monetico_reference ou end_to_end_id SEPA
  subscription_id uuid,           -- pas de FK : la pièce survit à tout
  invoice_id      uuid,
  cabinet_name    text not null,  -- pièce comptable : conservée 10 ans
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.billing_ledger is
  'Journal comptable append-only (10 ans). Aucune modification, aucune suppression applicative.';

create index billing_ledger_occurred_idx on public.billing_ledger (occurred_at desc);
create index billing_ledger_reference_idx on public.billing_ledger (reference);
create index billing_ledger_subscription_idx on public.billing_ledger (subscription_id);

-- ----------------------------------------------------------------------------
-- invoices — factures B2B (obligatoires, art. 289 CGI / L441-9 C. com.).
-- Numérotation continue par année : MP-F-AAAA-NNNN (compteur verrouillé).
-- ----------------------------------------------------------------------------

create table public.invoice_counters (
  year       int primary key,
  last_value int not null default 0
);

create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique,  -- MP-F-2026-0001
  subscription_id   uuid,
  pending_signup_id uuid,
  kind              text not null check (kind in ('card_first', 'sdd_renewal', 'credit_note')),
  amount_cents      int not null,
  currency          text not null default 'EUR',
  issued_at         timestamptz not null default now(),
  pdf_path          text not null,  -- bucket privé 'billing' (accès par URL signée courte)
  pdf_sha256        text not null,
  meta              jsonb not null default '{}'::jsonb
);

comment on table public.invoices is
  'Factures émises (pièces comptables, 10 ans). PDF dans le bucket privé billing.';

create index invoices_subscription_idx on public.invoices (subscription_id, issued_at desc);
create index invoices_issued_idx on public.invoices (issued_at desc);

-- Numéro de facture suivant — même pattern atomique que hit_rate_limit (0006).
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year  int := extract(year from (now() at time zone 'Europe/Paris'))::int;
  v_value int;
begin
  insert into public.invoice_counters as ic (year, last_value)
  values (v_year, 1)
  on conflict (year)
    do update set last_value = ic.last_value + 1
  returning ic.last_value into v_value;

  return format('MP-F-%s-%s', v_year, lpad(v_value::text, 4, '0'));
end;
$$;

comment on function public.next_invoice_number() is
  'Numéro de facture suivant (MP-F-AAAA-NNNN), compteur annuel atomique.';

revoke all on function public.next_invoice_number() from public, anon, authenticated;
grant execute on function public.next_invoice_number() to service_role;
