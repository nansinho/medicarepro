-- ============================================================================
-- 0023 — Compatibilité de signature pour record_monetico_ipn.
--
-- La 0021 a remplacé record_monetico_ipn(text,text,int,text,jsonb) par une
-- version à 7 paramètres (clé d'événement + horodatage de l'échéance). Or la
-- base est partagée avec l'application DÉJÀ DÉPLOYÉE, qui appelle encore
-- l'ancienne signature : tout IPN reçu par la version en ligne échouait donc
-- en « function does not exist », l'interface retour répondait cdr=1, et le
-- dossier restait bloqué en payment_pending malgré l'encaissement.
--
-- On rétablit l'ancienne signature comme simple façade : elle délègue à la
-- version 7 paramètres avec une clé d'événement vide, ce qui fait retomber
-- l'idempotence sur la clé historique (référence + code-retour). Le
-- comportement d'avant la 0021 est donc restitué à l'identique pour le code
-- déployé, pendant que la nouvelle version sert le code à jour.
--
-- Cette façade pourra être supprimée une fois la mise en production faite.
-- ============================================================================

create or replace function public.record_monetico_ipn(
  p_reference    text,
  p_code_retour  text,
  p_amount_cents int,
  p_currency     text,
  p_raw          jsonb
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.record_monetico_ipn(
    p_reference,
    p_code_retour,
    '',    -- pas de clé d'événement : idempotence historique
    null,  -- horodatage de l'échéance inconnu → now() côté fonction
    p_amount_cents,
    p_currency,
    p_raw
  );
$$;

comment on function public.record_monetico_ipn(text, text, int, text, jsonb) is
  'Façade de compatibilité (signature d''avant la 0021) — délègue à la version 7 paramètres. À retirer après mise en production.';

revoke all on function public.record_monetico_ipn(text, text, int, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_monetico_ipn(text, text, int, text, jsonb)
  to service_role;
