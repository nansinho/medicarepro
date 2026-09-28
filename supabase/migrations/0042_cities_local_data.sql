-- ============================================================================
-- 0042 — Pages villes : données locales réelles + contrôle qualité automatique
--
-- · insee_code : code commune INSEE (clé de rapprochement avec les sources
--   publiques ; Paris, Lyon, Marseille = code de la ville entière).
-- · local_data : chiffres affichés et seuls chiffres autorisés dans le texte
--   généré (pédicures-podologues : Annuaire Santé / RPPS ; population :
--   INSEE via geo.api.gouv.fr). Forme : src/lib/cms/city-data.ts.
-- · quality : rapport du contrôle automatique (src/lib/ai/city-quality.ts).
--   Une page conforme passe en 'approved' sans relecture humaine ; une page
--   qui échoue après régénération reste en 'needs_review'. La publication
--   reste un geste explicite, par vague (scripts/cities-publish.ts).
-- ============================================================================

alter table public.cities
  add column if not exists insee_code text,
  add column if not exists local_data jsonb,
  add column if not exists quality jsonb;

create unique index if not exists cities_insee_code_key on public.cities (insee_code);

comment on column public.cities.insee_code is 'Code commune INSEE (villes PLM : code de la ville entière).';
comment on column public.cities.local_data is 'Données locales sourcées (Annuaire Santé, INSEE) : seuls chiffres autorisés sur la page.';
comment on column public.cities.quality is 'Rapport du contrôle qualité SEO automatique (issues, similarité, tentatives).';
