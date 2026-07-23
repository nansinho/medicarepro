-- ============================================================================
-- 0021 — Monetico « Paiement Récurrent » : encaissement des reconductions.
--
-- Le contrat MEDICARE PRO dispose d'un TPE virtuel par mode ; les abonnements
-- passent désormais par le TPE récurrent (NB8179R). Conséquence : le serveur
-- Monetico rejoue lui-même chaque échéance et nous renotifie sur la MÊME
-- interface Retour, avec la MÊME référence et le MÊME code-retour que le
-- premier paiement.
--
-- Or l'idempotence de 0013 était (reference || ':' || code_retour) : toute
-- échéance de reconduction retombait sur 'replay' et disparaissait
-- silencieusement — argent encaissé côté banque, invisible côté application.
--
-- Cette migration :
--   1. ajoute à `subscriptions` l'adresse de facturation (les factures de
--      reconduction sont émises des mois après la purge RGPD de
--      pending_signups.cabinet) et le suivi de récurrence ;
--   2. ouvre `billing_ledger.event_type` et `invoices.kind` au renouvellement
--      carte ;
--   3. pose une garde comptable : une seule écriture 'card_renewal' par
--      (référence, date d'échéance) ;
--   4. remplace record_monetico_ipn par une version qui discrimine les
--      échéances sur le champ `date` de l'IPN et matérialise la reconduction.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. subscriptions — adresse de facturation figée + suivi de la récurrence.
-- ----------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists cabinet_address       text not null default '',
  add column if not exists cabinet_postal_city   text not null default '',
  add column if not exists renewal_count         int  not null default 0,
  add column if not exists last_renewal_at       timestamptz,
  add column if not exists recurrence_stopped_at timestamptz;

comment on column public.subscriptions.cabinet_address is
  'Adresse de facturation figée à la souscription (pending_signups est anonymisé à 90 j).';
comment on column public.subscriptions.renewal_count is
  'Nombre d''échéances de reconduction encaissées depuis le premier paiement.';
comment on column public.subscriptions.recurrence_stopped_at is
  'Date d''envoi du stoprecurrence=OUI à Monetico (plus aucune reconduction attendue).';

-- Reprise des souscriptions existantes dont le dossier n'est pas encore purgé.
update public.subscriptions s
   set cabinet_address     = coalesce(p.cabinet ->> 'address', ''),
       cabinet_postal_city = trim(
         coalesce(p.cabinet ->> 'postalCode', '') || ' ' ||
         coalesce(p.cabinet ->> 'city', '')
       )
  from public.pending_signups p
 where p.id = s.pending_signup_id
   and s.cabinet_address = '';

-- ----------------------------------------------------------------------------
-- 2. Nouveaux types d'événement comptable et de facture.
-- ----------------------------------------------------------------------------

alter table public.billing_ledger
  drop constraint if exists billing_ledger_event_type_check;
alter table public.billing_ledger
  add constraint billing_ledger_event_type_check check (event_type in (
    'card_payment',     -- 1er paiement Monetico
    'card_renewal',     -- échéance de reconduction (TPE Paiement Récurrent)
    'card_refund',      -- remboursement carte (manuel CIC)
    'sdd_collected',    -- prélèvement SEPA collecté
    'sdd_rejected',     -- prélèvement rejeté (R-transaction)
    'sdd_refunded',     -- remboursement SEPA (8 sem. Core / 13 mois MD01)
    'rtransaction_fee'  -- frais bancaires refacturés
  ));

alter table public.invoices
  drop constraint if exists invoices_kind_check;
alter table public.invoices
  add constraint invoices_kind_check check (kind in (
    'card_first',
    'card_renewal',
    'sdd_renewal',
    'credit_note'
  ));

-- ----------------------------------------------------------------------------
-- 3. Garde comptable : une échéance de reconduction ne peut être écrite
--    qu'UNE fois, même si Monetico re-présente la notification.
--    (occurred_at = champ `date` de l'IPN, unique par débit.)
-- ----------------------------------------------------------------------------

create unique index if not exists billing_ledger_card_renewal_idx
  on public.billing_ledger (reference, occurred_at)
  where event_type = 'card_renewal';

-- ----------------------------------------------------------------------------
-- 4. record_monetico_ipn v2.
--
-- Signature élargie : p_event_key (champ `date` brut de l'IPN, qui discrimine
-- deux échéances d'une même commande) et p_occurred_at (ce même instant,
-- parsé côté application).
--
-- Retours ajoutés :
--   'renewed'                 échéance de reconduction encaissée et comptabilisée
--   'renewed_amount_mismatch' idem, mais montant ≠ renewal_amount_cents → alerte
--   'renew_duplicate'         échéance déjà comptabilisée (re-présentation)
-- ----------------------------------------------------------------------------

drop function if exists public.record_monetico_ipn(text, text, int, text, jsonb);

create or replace function public.record_monetico_ipn(
  p_reference    text,
  p_code_retour  text,
  p_event_key    text,
  p_occurred_at  timestamptz,
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
  v_sub   public.subscriptions%rowtype;
  v_at    timestamptz := coalesce(p_occurred_at, now());
begin
  -- 1. Journal idempotent. La clé porte désormais la date de l'échéance :
  --    deux reconductions d'une même commande sont deux événements distincts,
  --    mais une re-présentation du MÊME débit reste un 'replay'.
  --    Sans date (cas dégradé), on retombe sur la clé historique de 0013.
  insert into public.ipn_events
    (provider, provider_event_id, reference, code_retour, amount_cents, currency, raw)
  values
    ('monetico',
     p_reference || ':' || p_code_retour ||
       case when coalesce(p_event_key, '') = '' then '' else ':' || p_event_key end,
     p_reference, p_code_retour, p_amount_cents, p_currency, p_raw)
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

    -- 2a. Premier paiement du dossier.
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

    -- 2b. Dossier déjà provisionné : échéance de reconduction du TPE récurrent.
    select * into v_sub
      from public.subscriptions
     where monetico_reference = p_reference
       for update;

    -- Le délai minimal écarte une re-présentation tardive du premier paiement
    -- sous une clé d'événement nouvelle (la reconduction la plus courte est
    -- mensuelle : jamais moins de 28 jours après la souscription).
    if found and v_at > v_sub.started_at + interval '20 days' then
      insert into public.billing_ledger
        (event_type, amount_cents, currency, occurred_at, reference,
         subscription_id, cabinet_name, meta)
      values
        ('card_renewal',
         coalesce(p_amount_cents, v_sub.renewal_amount_cents),
         coalesce(p_currency, v_sub.currency),
         v_at, p_reference, v_sub.id, v_sub.cabinet_name,
         jsonb_build_object('code_retour', p_code_retour, 'plan', v_sub.plan))
      on conflict do nothing;

      get diagnostics v_count = row_count;
      if v_count = 0 then
        return 'renew_duplicate';
      end if;

      update public.subscriptions
         set current_period_end = greatest(current_period_end, v_at)
                                  + case when plan = 'ANNUAL'
                                         then interval '12 months'
                                         else interval '1 month' end,
             -- une souscription résiliée ne « revit » pas : l'échéance est
             -- encaissée et prolonge la période, l'état reste à traiter à la main.
             status = case when status = 'canceled' then status else 'active' end,
             renewal_count = renewal_count + 1,
             last_renewal_at = v_at
       where id = v_sub.id;

      if p_amount_cents is not null
         and p_amount_cents is distinct from v_sub.renewal_amount_cents then
        return 'renewed_amount_mismatch';
      end if;
      return 'renewed';
    end if;

    -- Dossier avancé sans souscription (ou échéance trop précoce) : rejeu métier.
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

comment on function public.record_monetico_ipn(text, text, text, timestamptz, int, text, jsonb) is
  'Traite une notification Monetico (MAC déjà vérifié) : journal idempotent, premier paiement ou échéance de reconduction.';

revoke all on function public.record_monetico_ipn(text, text, text, timestamptz, int, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_monetico_ipn(text, text, text, timestamptz, int, text, jsonb)
  to service_role;
