-- ============================================================================
-- 0024 — Suivi de l'encaissement réel de chaque échéance.
--
-- Un TPE en Paiement Récurrent autorise mais N'ENCAISSE PAS : chaque échéance
-- reste « Enregistré », montant restant égal au montant total, tant qu'une
-- mise en recouvrement n'a pas été demandée. Vérifié sur la plateforme de test
-- le 24/07/2026 (référence MPB19GK81GC9).
--
-- Conséquence : une écriture au billing_ledger ne prouvait jusqu'ici qu'une
-- AUTORISATION, pas un encaissement. On distingue désormais les deux, sinon on
-- facture et on provisionne un client dont l'argent n'a jamais été prélevé.
-- ============================================================================

alter table public.billing_ledger
  add column if not exists captured_at   timestamptz,
  add column if not exists capture_error text;

comment on column public.billing_ledger.captured_at is
  'Date de la mise en recouvrement acceptée par la banque. NULL = autorisé mais pas encore encaissé.';
comment on column public.billing_ledger.capture_error is
  'Dernier refus de la banque sur la demande de recouvrement (libellé bancaire).';

-- File des échéances autorisées restant à encaisser.
create index if not exists billing_ledger_a_encaisser_idx
  on public.billing_ledger (occurred_at)
  where captured_at is null and event_type in ('card_payment', 'card_renewal');

-- Les écritures antérieures au TPE récurrent étaient encaissées d'office par
-- le TPE précédent : on les marque capturées pour ne pas les faire ressortir
-- dans la file.
update public.billing_ledger
   set captured_at = occurred_at
 where captured_at is null
   and event_type in ('card_payment', 'card_renewal')
   and occurred_at < '2026-07-24T00:00:00+02:00';

-- MPB19GK81GC9 : première échéance du TPE récurrent, mise en recouvrement à la
-- main depuis le tableau de bord pour valider le mécanisme. Sans cette ligne,
-- l'automate tenterait de l'encaisser une seconde fois.
update public.billing_ledger
   set captured_at = now()
 where reference = 'MPB19GK81GC9'
   and captured_at is null;
