-- ============================================================
-- 0037 — Plus de maximum de collaborateurs.
--
-- Le client a confirmé le 05/08/2026 qu'un abonnement n'a pas de limite de
-- collaborateurs. Le plafond de 20, hérité de la première grille tarifaire,
-- refusait donc une vente légitime : un cabinet de 25 praticiens ne pouvait
-- pas souscrire, et l'erreur ne se serait vue qu'au moment du refus.
--
-- On ne retire pas la contrainte, on la relève. Ce qui reste n'est plus une
-- limite d'offre mais un garde-fou de saisie : la valeur arrive par une requête
-- JSON, et sans borne un nombre absurde posté à la main ouvrirait un abonnement
-- à plusieurs centaines de milliers d'euros chez Stripe. Le contrôle applicatif
-- (MAX_EXTRA_COLLABORATORS) porte la même valeur ; celui-ci est le dernier rempart.
--
-- Ré-exécutable : chaque contrainte est retirée puis reposée.
-- ============================================================

alter table public.pending_signups
  drop constraint if exists pending_signups_extra_collaborators_check;
alter table public.pending_signups
  add constraint pending_signups_extra_collaborators_check
  check (extra_collaborators between 0 and 200);

alter table public.subscription_orders
  drop constraint if exists subscription_orders_extra_collaborators_check;
alter table public.subscription_orders
  add constraint subscription_orders_extra_collaborators_check
  check (extra_collaborators between 0 and 200);

alter table public.subscription_changes
  drop constraint if exists subscription_changes_target_extra_collaborators_check;
alter table public.subscription_changes
  add constraint subscription_changes_target_extra_collaborators_check
  check (target_extra_collaborators between 0 and 200);
