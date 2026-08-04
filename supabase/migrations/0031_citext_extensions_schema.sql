-- ============================================================================
-- 0031 — citext hors de public (lint Supabase 0014 extension_in_public)
--
-- POURQUOI CE N'EST PAS COSMÉTIQUE : citext installe dans public une quinzaine
-- de surcharges (replace, split_part, strpos, translate, regexp_match,
-- regexp_matches, regexp_replace, regexp_split_to_*) qui MASQUENT les fonctions
-- pg_catalog du même nom pour quiconque a public en tête de search_path, et que
-- PostgREST expose au passage en RPC. On les sort de l'espace applicatif.
--
-- POURQUOI C'EST DANGEREUX SI ON BÂCLE : mesuré sur cette base, avec citext
-- déplacé et un search_path ne contenant PAS extensions, la requête
--   select … from public.profiles where email = 'CONTACT@HARUA-DS.COM'
-- renvoie 0 ligne SANS LEVER D'ERREUR. L'opérateur =(citext, citext) devient
-- invisible, le cast implicite citext→text prend le relais, et la comparaison
-- redevient sensible à la casse. Une panne silencieuse sur les recherches par
-- email (profiles, newsletter_subscribers, contact_requests, consent_records,
-- subscriptions.cabinet_email/admin_email, sepa_mandates.debtor_email), pas un
-- plantage visible. C'est le pire mode de défaillance possible : d'où l'ordre
-- des opérations ci-dessous et l'assertion bloquante de l'étape 2.
--
-- CE QUI N'EST PAS CONCERNÉ : les policies RLS, index, contraintes et vues
-- stockent des OID d'opérateurs déjà résolus, ils sont insensibles au
-- search_path. Seul le SQL analysé à l'exécution l'est. Vérifié : aucune
-- fonction du schéma ne COMPARE de colonne citext (handle_new_user et
-- protect_profile_columns ne font que des affectations, résolues par cast).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Apprendre à PostgREST à chercher dans extensions
--
-- Sans toucher à Coolify : PostgREST lit sa configuration DEPUIS LA BASE
-- (db-config, actif par défaut), via les réglages « pgrst.* » portés par le rôle
-- authenticator. Ce réglage vit donc dans pg_authid, il survit aux redémarrages
-- et aux redéploiements du conteneur.
--
-- ⚠️ Un pg_dump de la base ne transporte PAS les réglages de rôle (ils sont
-- globaux au cluster, pg_dumpall --globals). Une restauration sur une instance
-- neuve doit donc rejouer CETTE migration, sinon on retombe exactement dans le
-- repli silencieux décrit plus haut.
-- ----------------------------------------------------------------------------

alter role authenticator set pgrst.db_extra_search_path = 'public, extensions';

-- ----------------------------------------------------------------------------
-- 2. Assertion bloquante : pas de déplacement sans la configuration
--
-- L'étape 3 ne doit jamais pouvoir s'exécuter seule. DDL transactionnelle
-- oblige : si l'assertion échoue, TOUTE la migration est annulée.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from pg_roles r,
           unnest(coalesce(r.rolconfig, '{}')) cfg
     where r.rolname = 'authenticator'
       and cfg like 'pgrst.db\_extra\_search\_path=%'
       and cfg like '%extensions%'
  ) then
    raise exception
      'Refus de déplacer citext : le rôle authenticator ne porte pas pgrst.db_extra_search_path avec extensions. Les recherches par email deviendraient silencieusement sensibles à la casse.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Déplacement (conditionnel : rejouable sans erreur)
-- ----------------------------------------------------------------------------

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'citext' and n.nspname = 'public'
  ) then
    alter extension citext set schema extensions;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Rechargement de PostgREST (config + cache de schéma)
-- ----------------------------------------------------------------------------

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 5. Aligner les fonctions SECURITY DEFINER sur le même search_path
--
-- MESURÉ, pas supposé : après le déplacement, dans une fonction réglée sur
-- « search_path = public », insérer 'SoNdE@Case.Fr' puis chercher
-- « where email = 'sonde@case.fr' » renvoie 0 ligne, sans erreur. L'index
-- unique, lui, continue de rejeter le doublon (il porte l'opclass par OID).
-- Le comportement se scinde donc en deux : unicité insensible à la casse,
-- lecture sensible. Piège garanti pour la prochaine fonction écrite.
--
-- Les 9 fonctions SECURITY DEFINER du projet (handle_new_user, hit_rate_limit,
-- next_invoice_number, next_sepa_rum, record_monetico_ipn ×2, record_not_found,
-- record_redirect_hit, claim_ai_generation) portent « search_path = public ».
-- Aucune ne compare de citext aujourd'hui, mais on aligne leur environnement
-- sur celui de PostgREST plutôt que de compter là-dessus.
--
-- Sans risque de détournement : anon/authenticated n'ont pas CREATE sur
-- extensions, ils ne peuvent donc rien y masquer.
--
-- Boucle plutôt que liste en dur : rattrape aussi les fonctions ajoutées après
-- coup, et reste rejouable.
-- ----------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=public')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Vérification post-déplacement (à lancer une fois PostgREST rechargé)
--
--   curl "$URL/rest/v1/profiles?email=eq.CONTACT@EN-MAJUSCULES.COM&select=id" \
--        -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
--
-- Doit renvoyer la ligne. Un tableau vide = la casse n'est plus ignorée =
-- configuration PostgREST non prise en compte : revenir en arrière avec
--   alter extension citext set schema public;
-- ----------------------------------------------------------------------------
