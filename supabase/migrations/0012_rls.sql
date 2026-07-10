-- ============================================================================
-- 0012 — Row Level Security : activation sur TOUTES les tables + policies
--
-- Matrice (plan §2/§5) :
--   anon           : lecture published uniquement (vitrine) ; zéro accès aux
--                    tables sensibles (contacts, newsletter, IA, GSC, audit…)
--   staff          : is_staff() (admin|editor via JWT app_metadata.role) —
--                    lecture complète + insert/update sur le contenu
--   admin          : is_admin() — DELETE + site_settings + redirections +
--                    suppressions sensibles
--   service_role   : bypass RLS (écritures server-only : formulaires publics,
--                    jobs, audit_log, GSC, compteurs de redirections)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Activation RLS sur toutes les tables
-- ----------------------------------------------------------------------------

alter table public.profiles               enable row level security;
alter table public.pages                  enable row level security;
alter table public.page_sections          enable row level security;
alter table public.revisions              enable row level security;
alter table public.categories             enable row level security;
alter table public.posts                  enable row level security;
alter table public.tags                   enable row level security;
alter table public.post_tags              enable row level security;
alter table public.testimonials           enable row level security;
alter table public.faq_items              enable row level security;
alter table public.pricing_plans          enable row level security;
alter table public.pricing_examples       enable row level security;
alter table public.feature_items          enable row level security;
alter table public.menus                  enable row level security;
alter table public.site_settings          enable row level security;
alter table public.contact_requests       enable row level security;
alter table public.contact_request_notes  enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.rate_limits            enable row level security;
alter table public.media                  enable row level security;
alter table public.seo_meta               enable row level security;
alter table public.redirects              enable row level security;
alter table public.not_found_logs         enable row level security;
alter table public.seo_audits             enable row level security;
alter table public.seo_audit_findings     enable row level security;
alter table public.cities                 enable row level security;
alter table public.city_nearby            enable row level security;
alter table public.topics                 enable row level security;
alter table public.briefs                 enable row level security;
alter table public.ai_generations         enable row level security;
alter table public.gsc_metrics            enable row level security;
alter table public.gsc_sync_runs          enable row level security;
alter table public.gsc_url_inspections    enable row level security;
alter table public.keywords               enable row level security;
alter table public.keyword_positions      enable row level security;
alter table public.audit_log              enable row level security;
alter table public.job_runs               enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Défense en profondeur (privilèges) — en plus des policies RLS
-- ----------------------------------------------------------------------------

-- anon n'écrit JAMAIS directement (les formulaires publics passent par le
-- service-role côté serveur) : retrait global des privilèges d'écriture.
revoke insert, update, delete on all tables in schema public from anon;

-- Tables 100 % interdites à anon : retrait de tous les privilèges
-- (RLS bloque déjà — ceci protège aussi contre une future policy trop large).
revoke all on table
  public.profiles,
  public.revisions,
  public.contact_requests,
  public.contact_request_notes,
  public.newsletter_subscribers,
  public.rate_limits,
  public.not_found_logs,
  public.seo_audits,
  public.seo_audit_findings,
  public.topics,
  public.briefs,
  public.ai_generations,
  public.gsc_metrics,
  public.gsc_sync_runs,
  public.gsc_url_inspections,
  public.keywords,
  public.keyword_positions,
  public.audit_log,
  public.job_runs
from anon;

-- rate_limits : manipulée uniquement via hit_rate_limit() (SECURITY DEFINER).
revoke all on table public.rate_limits from authenticated;

-- audit_log append-only : personne ne modifie/supprime via PostgREST
-- (insert = service-role uniquement, qui bypasse RLS).
revoke insert, update, delete on table public.audit_log from authenticated;

-- page_sections.draft invisible pour anon.
-- NB : les privilèges de colonnes Postgres sont additifs — un simple
-- « REVOKE SELECT (draft) » serait sans effet face au GRANT table entière.
-- On retire donc le SELECT table à anon puis on re-grante colonne par colonne
-- (tout SAUF draft). Conséquence : les fetchers publics doivent lister leurs
-- colonnes explicitement (pas de « select * » anon sur page_sections).
-- authenticated garde draft : l'éditeur admin lit coalesce(draft, content)
-- via le client user (RLS), et Postgres ne sait pas distinguer les rôles JWT
-- au niveau des privilèges de colonnes.
revoke select on table public.page_sections from anon;
grant select (id, page_id, section_key, position, type, content, updated_by, created_at, updated_at)
  on public.page_sections to anon;

-- ----------------------------------------------------------------------------
-- 3. profiles — staff lit tout ; chacun met à jour SA ligne (display_name /
--    avatar uniquement, verrou par trigger) ; admin met à jour tout le monde.
--    Aucune policy anon. INSERT/DELETE : service-role + triggers auth only.
-- ----------------------------------------------------------------------------

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Verrou colonnes : un non-admin ne peut changer que display_name / avatar.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- service_role / postgres (jobs, scripts) : aucune restriction.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;

  if not public.is_admin() then
    -- editor (sa propre ligne) : seuls display_name et avatar_media_id bougent.
    new.email := old.email;
    new.role  := old.role;
  end if;

  return new;
end;
$$;

create trigger trg_profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ----------------------------------------------------------------------------
-- 4. Contenu vitrine — anon lit le publié, staff gère, admin supprime
-- ----------------------------------------------------------------------------

-- pages
create policy pages_select_public on public.pages
  for select to anon, authenticated
  using (status = 'published');
create policy pages_select_staff on public.pages
  for select to authenticated using (public.is_staff());
create policy pages_insert_staff on public.pages
  for insert to authenticated with check (public.is_staff());
create policy pages_update_staff on public.pages
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy pages_delete_admin on public.pages
  for delete to authenticated using (public.is_admin());

-- page_sections (visibles si la page parente est publiée)
create policy page_sections_select_public on public.page_sections
  for select to anon, authenticated
  using (exists (
    select 1 from public.pages p
    where p.id = page_id and p.status = 'published'
  ));
create policy page_sections_select_staff on public.page_sections
  for select to authenticated using (public.is_staff());
create policy page_sections_insert_staff on public.page_sections
  for insert to authenticated with check (public.is_staff());
create policy page_sections_update_staff on public.page_sections
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy page_sections_delete_admin on public.page_sections
  for delete to authenticated using (public.is_admin());

-- revisions (staff lit + insère ; pas d'update ; purge via service-role)
create policy revisions_select_staff on public.revisions
  for select to authenticated using (public.is_staff());
create policy revisions_insert_staff on public.revisions
  for insert to authenticated with check (public.is_staff());

-- categories / tags / post_tags (taxonomie : lecture publique nécessaire au blog)
create policy categories_select_public on public.categories
  for select to anon, authenticated using (true);
create policy categories_insert_staff on public.categories
  for insert to authenticated with check (public.is_staff());
create policy categories_update_staff on public.categories
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy categories_delete_admin on public.categories
  for delete to authenticated using (public.is_admin());

create policy tags_select_public on public.tags
  for select to anon, authenticated using (true);
create policy tags_insert_staff on public.tags
  for insert to authenticated with check (public.is_staff());
create policy tags_update_staff on public.tags
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy tags_delete_admin on public.tags
  for delete to authenticated using (public.is_admin());

-- post_tags : table de jointure — le retrait d'un tag est une édition de
-- contenu, pas une suppression destructive → delete staff (et non admin-only).
create policy post_tags_select_public on public.post_tags
  for select to anon, authenticated using (true);
create policy post_tags_insert_staff on public.post_tags
  for insert to authenticated with check (public.is_staff());
create policy post_tags_delete_staff on public.post_tags
  for delete to authenticated using (public.is_staff());

-- posts
create policy posts_select_public on public.posts
  for select to anon, authenticated
  using (status = 'published');
create policy posts_select_staff on public.posts
  for select to authenticated using (public.is_staff());
create policy posts_insert_staff on public.posts
  for insert to authenticated with check (public.is_staff());
create policy posts_update_staff on public.posts
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy posts_delete_admin on public.posts
  for delete to authenticated using (public.is_admin());

-- testimonials
create policy testimonials_select_public on public.testimonials
  for select to anon, authenticated using (published);
create policy testimonials_select_staff on public.testimonials
  for select to authenticated using (public.is_staff());
create policy testimonials_insert_staff on public.testimonials
  for insert to authenticated with check (public.is_staff());
create policy testimonials_update_staff on public.testimonials
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy testimonials_delete_admin on public.testimonials
  for delete to authenticated using (public.is_admin());

-- faq_items
create policy faq_items_select_public on public.faq_items
  for select to anon, authenticated using (published);
create policy faq_items_select_staff on public.faq_items
  for select to authenticated using (public.is_staff());
create policy faq_items_insert_staff on public.faq_items
  for insert to authenticated with check (public.is_staff());
create policy faq_items_update_staff on public.faq_items
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy faq_items_delete_admin on public.faq_items
  for delete to authenticated using (public.is_admin());

-- pricing_plans
create policy pricing_plans_select_public on public.pricing_plans
  for select to anon, authenticated using (published);
create policy pricing_plans_select_staff on public.pricing_plans
  for select to authenticated using (public.is_staff());
create policy pricing_plans_insert_staff on public.pricing_plans
  for insert to authenticated with check (public.is_staff());
create policy pricing_plans_update_staff on public.pricing_plans
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy pricing_plans_delete_admin on public.pricing_plans
  for delete to authenticated using (public.is_admin());

-- pricing_examples (pas de colonne published : lecture publique complète)
create policy pricing_examples_select_public on public.pricing_examples
  for select to anon, authenticated using (true);
create policy pricing_examples_insert_staff on public.pricing_examples
  for insert to authenticated with check (public.is_staff());
create policy pricing_examples_update_staff on public.pricing_examples
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy pricing_examples_delete_admin on public.pricing_examples
  for delete to authenticated using (public.is_admin());

-- feature_items
create policy feature_items_select_public on public.feature_items
  for select to anon, authenticated using (published);
create policy feature_items_select_staff on public.feature_items
  for select to authenticated using (public.is_staff());
create policy feature_items_insert_staff on public.feature_items
  for insert to authenticated with check (public.is_staff());
create policy feature_items_update_staff on public.feature_items
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy feature_items_delete_admin on public.feature_items
  for delete to authenticated using (public.is_admin());

-- menus
create policy menus_select_public on public.menus
  for select to anon, authenticated using (true);
create policy menus_insert_staff on public.menus
  for insert to authenticated with check (public.is_staff());
create policy menus_update_staff on public.menus
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy menus_delete_admin on public.menus
  for delete to authenticated using (public.is_admin());

-- site_settings : anon lit is_public ; staff lit tout ; écritures ADMIN only
-- (plan §2 : « admin = settings » — les onglets Réglages sont masqués aux éditeurs).
create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated using (is_public);
create policy site_settings_select_staff on public.site_settings
  for select to authenticated using (public.is_staff());
create policy site_settings_insert_admin on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy site_settings_update_admin on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy site_settings_delete_admin on public.site_settings
  for delete to authenticated using (public.is_admin());

-- media (bucket public-read → métadonnées publiques)
create policy media_select_public on public.media
  for select to anon, authenticated using (true);
create policy media_insert_staff on public.media
  for insert to authenticated with check (public.is_staff());
create policy media_update_staff on public.media
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy media_delete_admin on public.media
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. SEO
-- ----------------------------------------------------------------------------

-- seo_meta (lecture publique : nécessaire au rendu des métadonnées)
create policy seo_meta_select_public on public.seo_meta
  for select to anon, authenticated using (true);
create policy seo_meta_insert_staff on public.seo_meta
  for insert to authenticated with check (public.is_staff());
create policy seo_meta_update_staff on public.seo_meta
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy seo_meta_delete_admin on public.seo_meta
  for delete to authenticated using (public.is_admin());

-- redirects : anon lit les actives (map proxy) ; écritures ADMIN only ;
-- hits/last_hit_at incrémentés via service-role.
create policy redirects_select_public on public.redirects
  for select to anon, authenticated using (is_active);
create policy redirects_select_staff on public.redirects
  for select to authenticated using (public.is_staff());
create policy redirects_insert_admin on public.redirects
  for insert to authenticated with check (public.is_admin());
create policy redirects_update_admin on public.redirects
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy redirects_delete_admin on public.redirects
  for delete to authenticated using (public.is_admin());

-- not_found_logs : staff consulte (top 404) ; écritures via service-role ;
-- admin purge.
create policy not_found_logs_select_staff on public.not_found_logs
  for select to authenticated using (public.is_staff());
create policy not_found_logs_delete_admin on public.not_found_logs
  for delete to authenticated using (public.is_admin());

-- seo_audits / findings : runs écrits par le job (service-role) ;
-- staff consulte et résout/ignore les findings ; admin purge.
create policy seo_audits_select_staff on public.seo_audits
  for select to authenticated using (public.is_staff());
create policy seo_audits_delete_admin on public.seo_audits
  for delete to authenticated using (public.is_admin());

create policy seo_audit_findings_select_staff on public.seo_audit_findings
  for select to authenticated using (public.is_staff());
create policy seo_audit_findings_update_staff on public.seo_audit_findings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy seo_audit_findings_delete_admin on public.seo_audit_findings
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Villes
-- ----------------------------------------------------------------------------

create policy cities_select_public on public.cities
  for select to anon, authenticated
  using (status = 'published');
create policy cities_select_staff on public.cities
  for select to authenticated using (public.is_staff());
create policy cities_insert_staff on public.cities
  for insert to authenticated with check (public.is_staff());
create policy cities_update_staff on public.cities
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cities_delete_admin on public.cities
  for delete to authenticated using (public.is_admin());

-- city_nearby : visible publiquement si les deux villes sont publiées
-- (bloc « près de {Ville} ») ; édition du maillage = staff (delete inclus,
-- retirer un lien est une édition, pas une suppression destructive).
create policy city_nearby_select_public on public.city_nearby
  for select to anon, authenticated
  using (
    exists (select 1 from public.cities c
            where c.id = city_id and c.status = 'published')
    and exists (select 1 from public.cities c2
                where c2.id = nearby_city_id and c2.status = 'published')
  );
create policy city_nearby_select_staff on public.city_nearby
  for select to authenticated using (public.is_staff());
create policy city_nearby_insert_staff on public.city_nearby
  for insert to authenticated with check (public.is_staff());
create policy city_nearby_update_staff on public.city_nearby
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy city_nearby_delete_staff on public.city_nearby
  for delete to authenticated using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 7. Échanges (contacts / newsletter) — zéro accès anon, inserts service-role
-- ----------------------------------------------------------------------------

create policy contact_requests_select_staff on public.contact_requests
  for select to authenticated using (public.is_staff());
-- statuts / assignation gérés depuis l'inbox (client user + RLS)
create policy contact_requests_update_staff on public.contact_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy contact_requests_delete_admin on public.contact_requests
  for delete to authenticated using (public.is_admin());

create policy contact_request_notes_select_staff on public.contact_request_notes
  for select to authenticated using (public.is_staff());
create policy contact_request_notes_insert_staff on public.contact_request_notes
  for insert to authenticated with check (public.is_staff());
create policy contact_request_notes_delete_admin on public.contact_request_notes
  for delete to authenticated using (public.is_admin());

create policy newsletter_subscribers_select_staff on public.newsletter_subscribers
  for select to authenticated using (public.is_staff());
create policy newsletter_subscribers_delete_admin on public.newsletter_subscribers
  for delete to authenticated using (public.is_admin());

-- rate_limits : AUCUNE policy — accès uniquement via hit_rate_limit()
-- (SECURITY DEFINER) et service-role.

-- ----------------------------------------------------------------------------
-- 8. IA — staff pilote (kanban, revue), worker écrit via service-role
-- ----------------------------------------------------------------------------

create policy topics_select_staff on public.topics
  for select to authenticated using (public.is_staff());
create policy topics_insert_staff on public.topics
  for insert to authenticated with check (public.is_staff());
create policy topics_update_staff on public.topics
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy topics_delete_staff on public.topics
  for delete to authenticated using (public.is_staff());

create policy briefs_select_staff on public.briefs
  for select to authenticated using (public.is_staff());
create policy briefs_insert_staff on public.briefs
  for insert to authenticated with check (public.is_staff());
create policy briefs_update_staff on public.briefs
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy briefs_delete_staff on public.briefs
  for delete to authenticated using (public.is_staff());

-- ai_generations : staff met en file (insert) et révise (update review_*) ;
-- le worker (claim/statuts/tokens) passe par service-role.
create policy ai_generations_select_staff on public.ai_generations
  for select to authenticated using (public.is_staff());
create policy ai_generations_insert_staff on public.ai_generations
  for insert to authenticated with check (public.is_staff());
create policy ai_generations_update_staff on public.ai_generations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ai_generations_delete_admin on public.ai_generations
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. GSC & mots-clés — lecture staff, écritures service-role (jobs)
-- ----------------------------------------------------------------------------

create policy gsc_metrics_select_staff on public.gsc_metrics
  for select to authenticated using (public.is_staff());

create policy gsc_sync_runs_select_staff on public.gsc_sync_runs
  for select to authenticated using (public.is_staff());

create policy gsc_url_inspections_select_staff on public.gsc_url_inspections
  for select to authenticated using (public.is_staff());

create policy keywords_select_staff on public.keywords
  for select to authenticated using (public.is_staff());
create policy keywords_insert_staff on public.keywords
  for insert to authenticated with check (public.is_staff());
create policy keywords_update_staff on public.keywords
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy keywords_delete_admin on public.keywords
  for delete to authenticated using (public.is_admin());

create policy keyword_positions_select_staff on public.keyword_positions
  for select to authenticated using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 10. Système — lecture staff ; écritures service-role uniquement
-- ----------------------------------------------------------------------------

create policy audit_log_select_staff on public.audit_log
  for select to authenticated using (public.is_staff());
-- append-only : aucune policy insert/update/delete (service-role bypasse RLS,
-- et les privilèges d'écriture ont été révoqués plus haut).

create policy job_runs_select_staff on public.job_runs
  for select to authenticated using (public.is_staff());
