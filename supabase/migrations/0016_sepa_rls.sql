-- ============================================================================
-- 0016 — RLS SEPA : lecture admin uniquement, écritures service-role seul.
-- Même posture que 0014 : grants colonne par colonne sur sepa_mandates
-- (iban_encrypted ne sort JAMAIS par PostgREST, même pour un admin).
-- ============================================================================

alter table public.sepa_rum_counters enable row level security;
alter table public.sepa_mandates     enable row level security;
alter table public.sepa_remittances  enable row level security;
alter table public.sepa_debits       enable row level security;
alter table public.app_sync_tasks    enable row level security;

-- ----------------------------------------------------------------------------
-- 1. Défense en profondeur : retrait des privilèges par défaut.
-- ----------------------------------------------------------------------------

revoke all on table
  public.sepa_rum_counters,
  public.sepa_mandates,
  public.sepa_remittances,
  public.sepa_debits,
  public.app_sync_tasks
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Grants de lecture pour authenticated.
--    sepa_mandates : SANS iban_encrypted (service-role uniquement).
-- ----------------------------------------------------------------------------

grant select (
  id, rum, subscription_id, status, scheme, account_holder,
  debtor_name, debtor_email, debtor_address, iban_last4, bic,
  mandate_text_version, mandate_text_sha256,
  signed_at, signature_method, signature_ip, signature_user_agent,
  pdf_path, pdf_sha256, last_debit_at, last_presented_at,
  amended_at, revoked_at, legal_hold, created_at, updated_at
) on public.sepa_mandates to authenticated;

grant select on public.sepa_remittances to authenticated;
grant select on public.sepa_debits      to authenticated;
grant select on public.app_sync_tasks   to authenticated;
-- sepa_rum_counters : aucun grant (service-role uniquement, via next_sepa_rum).

-- ----------------------------------------------------------------------------
-- 3. Policies : lecture réservée aux admins (is_admin(), cf. 0002).
-- ----------------------------------------------------------------------------

create policy sepa_mandates_select_admin
  on public.sepa_mandates for select using (public.is_admin());

create policy sepa_remittances_select_admin
  on public.sepa_remittances for select using (public.is_admin());

create policy sepa_debits_select_admin
  on public.sepa_debits for select using (public.is_admin());

create policy app_sync_tasks_select_admin
  on public.app_sync_tasks for select using (public.is_admin());

-- sepa_rum_counters : aucune policy (aucun accès hors service-role).
