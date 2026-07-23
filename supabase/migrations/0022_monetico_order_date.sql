-- ============================================================================
-- 0022 — Mémorisation de la date de commande Monetico.
--
-- L'arrêt de récurrence (capture_paiement.cgi + stoprecurrence=OUI) exige
-- `date_commande`, et la doc est explicite sur l'échec : « commande non
-- authentifiee — vérifier les paramètres référence et date_commande ». Une
-- date fausse d'un jour = résiliation refusée = client résilié qui continue
-- d'être prélevé.
--
-- Or cette date n'était persistée nulle part : elle était calculée à la volée
-- dans buildPaymentForm() au moment du POST /api/checkout. La re-dériver de
-- created_at est faux dès qu'un checkout traverse minuit (heure de Paris).
--
-- On la fige donc telle qu'ENVOYÉE, au format Monetico JJ/MM/AAAA, sur le
-- dossier puis sur la souscription (qui survit à la purge RGPD à 90 jours).
-- ============================================================================

alter table public.pending_signups
  add column if not exists monetico_order_date text;

alter table public.subscriptions
  add column if not exists monetico_order_date text;

comment on column public.pending_signups.monetico_order_date is
  'Champ `date` du formulaire aller, partie JJ/MM/AAAA — exigé tel quel par le service de capture.';
comment on column public.subscriptions.monetico_order_date is
  'Date de la commande initiale (JJ/MM/AAAA) : paramètre obligatoire de l''arrêt de récurrence.';

-- Reprise de l'existant : meilleure approximation disponible, l'instant de
-- création du dossier ramené à l'heure de Paris (le formulaire était scellé
-- dans la même requête HTTP, à quelques millisecondes près).
update public.pending_signups
   set monetico_order_date = to_char(created_at at time zone 'Europe/Paris', 'DD/MM/YYYY')
 where monetico_order_date is null;

update public.subscriptions s
   set monetico_order_date = coalesce(
         (select p.monetico_order_date
            from public.pending_signups p
           where p.id = s.pending_signup_id),
         to_char(s.started_at at time zone 'Europe/Paris', 'DD/MM/YYYY')
       )
 where s.monetico_order_date is null;
