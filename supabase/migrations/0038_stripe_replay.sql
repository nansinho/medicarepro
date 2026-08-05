-- ============================================================
-- 0038 — Rejouer les notifications Stripe restées sans effet.
--
-- CE QUI L'A RENDUE NÉCESSAIRE. La route accuse TOUJOURS réception par un 200
-- dès que l'événement est en sécurité dans le journal, et l'unicité d'event_id
-- fait échouer toute re-livraison avant les effets. Stripe ne rejoue donc jamais
-- rien pour nous, contrairement à ce que le code affirmait en commentaire.
--
-- Constaté le 05/08/2026 : trois `invoice.paid` et deux
-- `checkout.session.completed` dormaient dans le journal avec processed_at à
-- NULL, et AUCUNE facture Stripe n'avait été copiée dans notre registre. La
-- facture du premier client réel n'apparaissait nulle part chez nous.
--
-- La cause la plus fréquente est une course bénigne : la première facture d'un
-- abonnement arrive dans la même seconde que la session de paiement, donc avant
-- que le contrat n'existe. Il ne manquait qu'une reprise quelques minutes plus
-- tard.
--
-- Ré-exécutable.
-- ============================================================

alter table public.stripe_events
  add column if not exists process_attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz;

comment on column public.stripe_events.process_attempts is
  'Nombre de passages des effets. Sert au recul progressif et à l''alerte quand un événement résiste.';
comment on column public.stripe_events.next_attempt_at is
  'Heure à partir de laquelle le cron peut retenter. NULL = dès maintenant.';

-- Les événements déjà journalisés avant cette migration doivent être repris
-- tout de suite : ce sont eux qui ont révélé le défaut.
update public.stripe_events
   set next_attempt_at = now()
 where processed_at is null
   and next_attempt_at is null;

-- L'index qui sert la file de reprise. L'ancien (received_at seul) ne portait
-- pas l'heure de reprise et forçait un tri en mémoire.
create index if not exists stripe_events_replay_idx
  on public.stripe_events (next_attempt_at, received_at)
  where processed_at is null;
