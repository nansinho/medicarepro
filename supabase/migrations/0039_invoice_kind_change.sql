-- ============================================================
-- 0039 — Une facture de changement de formule n'est pas une reconduction.
--
-- Depuis que les augmentations sont encaissées sur-le-champ, Stripe émet une
-- facture dont le motif est `subscription_update`. Notre miroir la rangeait en
-- `card_renewal`, faute de mieux : l'admin affichait donc « Reconduction carte »
-- pour un ajout de collaborateurs.
--
-- Constaté le 06/08/2026 sur XVEY8ARG-0006 (359,99 €, ajout de collaborateurs
-- sur une offre 12 mois). Dans un registre comptable, appeler reconduction ce
-- qui est un supplément fausse toute lecture de l'historique d'un cabinet.
--
-- Ré-exécutable : la contrainte est retirée puis reposée.
-- ============================================================

alter table public.invoices
  drop constraint if exists invoices_kind_check;

alter table public.invoices
  add constraint invoices_kind_check check (kind in (
    'card_first',    -- premier paiement d'un abonnement
    'card_renewal',  -- échéance suivante, même formule
    'card_change',   -- supplément dû à un changement de formule ou d'effectif
    'sdd_renewal',   -- échéance prélevée par mandat SEPA
    'credit_note'    -- avoir
  ));

comment on column public.invoices.kind is
  'Nature de la pièce. card_change distingue un supplément de formule d''une reconduction : les confondre fausse la lecture comptable de l''historique.';
