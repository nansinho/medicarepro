-- ============================================================================
-- 0014 — RLS billing : lecture admin uniquement, écritures service-role seul.
--
-- Posture (durcie) :
--   anon          : ZÉRO accès (revoke all).
--   authenticated : lecture via is_admin() UNIQUEMENT (pas editor), et grants
--                   COLONNE PAR COLONNE — les secrets chiffrés (password_enc,
--                   sepa_payload_enc) et status_token ne sortent JAMAIS par
--                   PostgREST, même pour un admin. Seul serviceClient() les lit.
--   service_role  : bypass RLS (routes API server-only, crons, worker).
-- Aucune policy INSERT/UPDATE/DELETE : personne n'écrit hors service-role.
-- ============================================================================

alter table public.pending_signups  enable row level security;
alter table public.ipn_events       enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.billing_ledger   enable row level security;
alter table public.invoices         enable row level security;
alter table public.invoice_counters enable row level security;

-- ----------------------------------------------------------------------------
-- 1. Défense en profondeur : retrait des privilèges par défaut.
-- ----------------------------------------------------------------------------

revoke all on table
  public.pending_signups,
  public.ipn_events,
  public.subscriptions,
  public.billing_ledger,
  public.invoices,
  public.invoice_counters
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Grants colonne par colonne pour authenticated (lecture admin).
--    pending_signups : SANS password_enc, sepa_payload_enc, status_token.
-- ----------------------------------------------------------------------------

grant select (
  id, root_id, parent_id, monetico_reference, status, plan,
  extra_collaborators, amount_cents, currency, cabinet, user_info,
  invoice_prefix, reserved_rum, mandate_text_version, mandate_text_sha256,
  cgv_accepted_at, mandate_accepted_at, client_ip, user_agent,
  paid_at, code_retour, provisioned_at, app_cabinet_id, app_user_id,
  login_url, provision_attempts, next_retry_at, last_error,
  created_at, updated_at
) on public.pending_signups to authenticated;

grant select on public.ipn_events     to authenticated; -- raw déjà filtré à l'ingestion
grant select on public.subscriptions  to authenticated;
grant select on public.billing_ledger to authenticated;
grant select on public.invoices       to authenticated;
-- invoice_counters : aucun grant (service-role uniquement, via next_invoice_number).

-- ----------------------------------------------------------------------------
-- 3. Policies : lecture réservée aux admins (is_admin(), cf. 0002).
-- ----------------------------------------------------------------------------

create policy pending_signups_select_admin
  on public.pending_signups for select using (public.is_admin());

create policy ipn_events_select_admin
  on public.ipn_events for select using (public.is_admin());

create policy subscriptions_select_admin
  on public.subscriptions for select using (public.is_admin());

create policy billing_ledger_select_admin
  on public.billing_ledger for select using (public.is_admin());

create policy invoices_select_admin
  on public.invoices for select using (public.is_admin());

-- invoice_counters : aucune policy (aucun accès hors service-role).
