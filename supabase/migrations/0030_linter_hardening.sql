-- ============================================================================
-- 0030 — Durcissement suite au linter Supabase
--
-- Traite deux familles d'alertes :
--   0011 function_search_path_mutable (WARN) : 5 fonctions sans search_path fixe.
--   0008 rls_enabled_no_policy (INFO)        : 7 tables signalées, dont UNE
--                                              vraie anomalie (subscription_renewals).
--
-- Fichier AUTONOME et idempotent : il ne touche à aucune migration antérieure.
-- Sur base vierge il s'exécute en fin de chaîne et repose les réglages que
-- « create or replace function » des fichiers 0001/0002/0012 avait laissés par
-- défaut ; sur base déjà migrée il applique le delta. Même état final dans les
-- deux cas. Règle : on ne rejoue JAMAIS un fichier déjà appliqué, on n'exécute
-- que les migrations nouvelles, dans l'ordre.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. search_path figé sur les fonctions restantes (lint 0011)
--
-- Les 9 fonctions SECURITY DEFINER portent déjà « search_path = public » : leurs
-- corps utilisent des noms de tables non qualifiés. Les 5 ci-dessous sont
-- SECURITY INVOKER et référencent TOUT en qualifié (auth.jwt(), public.jwt_role(),
-- public.is_admin()) : on peut donc leur poser le réglage le plus strict,
-- search_path vide. pg_catalog reste implicitement résolu (now(), coalesce, les
-- opérateurs), seule la résolution implicite de « public » disparaît.
--
-- Effet de bord assumé : une fonction SQL portant une clause SET n'est plus
-- inlinée par le planificateur. is_admin()/is_staff() servent dans ~60 policies
-- RLS, mais aucune table ne dépasse ~7 000 lignes ici : le surcoût est nul à
-- cette échelle. Si un jour ça pèse, la parade est d'écrire les policies
-- « using ((select public.is_admin())) » (évaluation une fois par requête).
-- ----------------------------------------------------------------------------

alter function public.set_updated_at()          set search_path = '';
alter function public.jwt_role()                set search_path = '';
alter function public.is_admin()                set search_path = '';
alter function public.is_staff()                set search_path = '';
alter function public.protect_profile_columns() set search_path = '';

-- ----------------------------------------------------------------------------
-- 2. subscription_renewals : privilèges par défaut jamais retirés (lint 0008)
--
-- 0026 active bien la RLS mais a oublié le « revoke all » que portent toutes ses
-- voisines (0014, 0016, 0027, 0028, 0029). Conséquence constatée en base : c'est
-- la SEULE table du schéma public où « anon » détient encore INSERT/UPDATE/DELETE
-- (grants par défaut de Supabase sur toute table nouvellement créée).
--
-- Rien n'est exploitable aujourd'hui : RLS active sans policy bloque déjà tout.
-- Mais la défense en profondeur du projet repose sur les DEUX verrous, et une
-- future policy trop large sur cette table de paiements suffirait à ouvrir la
-- brèche. On aligne.
-- ----------------------------------------------------------------------------

revoke all on table public.subscription_renewals from anon, authenticated;

comment on table public.subscription_renewals is
  'Paiements de renouvellement de l''offre annuelle (prolongent une souscription existante). Service-role uniquement (RLS sans policy + privilèges retirés).';

-- ----------------------------------------------------------------------------
-- 3. Alertes restantes : décisions explicites, pas des oublis
--
-- a) lint 0008 sur invoice_counters, portal_links, rate_limits, sepa_rum_counters,
--    subscription_orders, subscription_reminders, subscription_renewals :
--    CONFORME AU DESIGN. « RLS active + zéro policy + zéro grant » est la
--    posture voulue (doctrine 0014) : ces tables ne se lisent QUE via
--    serviceClient() côté serveur, ou via des fonctions SECURITY DEFINER
--    (next_invoice_number, next_sepa_rum, hit_rate_limit). Le linter ne sait pas
--    distinguer « fermée volontairement » de « policy oubliée ». Ne pas y
--    ajouter de policy pour faire taire l'alerte.
--
-- b) lint 0014 extension_in_public (citext) : NON TRAITÉ ICI, volontairement.
--    Le déplacement casserait la production en l'état. Vérifié sur l'instance :
--    PostgREST tourne avec search_path = "public", "public" (extensions absent,
--    et les rôles anon/authenticated/service_role n'ont aucun search_path
--    propre). Déplacer citext rendrait l'opérateur =(citext, citext) irrésolu :
--    tout filtre par email (profiles, newsletter_subscribers, contact_requests,
--    pending_signups, sepa_mandates, consents) tomberait en erreur 42883.
--
--    Séquence correcte, dans cet ordre :
--      1. Coolify : PGRST_DB_EXTRA_SEARCH_PATH=public,extensions sur le service
--         PostgREST (« rest »), puis redémarrage.
--      2. Vérifier que le search_path vu par PostgREST contient extensions.
--      3. Alors seulement : alter extension citext set schema extensions;
--         et « create extension ... with schema extensions » dans 0001.
--    Gain réel une fois fait : citext installe dans public une quinzaine de
--    surcharges (replace, split_part, strpos, translate, regexp_*) qui masquent
--    les fonctions pg_catalog et sont exposées en RPC par PostgREST.
-- ----------------------------------------------------------------------------
