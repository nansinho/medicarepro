-- ============================================================================
-- 0008 — SEO : seo_meta, redirects, not_found_logs, seo_audits(+findings)
--        + Villes : cities (table autonome, workflow par vagues), city_nearby
-- ============================================================================

create table public.seo_meta (
  id                 uuid primary key default gen_random_uuid(),
  path               text not null unique,
  title              text,
  title_absolute     boolean not null default false, -- true = ignorer le template "| MediCare Pro"
  description        text,
  canonical          text,
  og_image_media_id  uuid references public.media (id) on delete set null,
  noindex            boolean not null default false,
  jsonld             jsonb,
  sitemap_include    boolean not null default true,
  sitemap_priority   numeric(2, 1) check (sitemap_priority between 0.0 and 1.0),
  sitemap_changefreq text check (sitemap_changefreq in ('daily', 'weekly', 'monthly', 'yearly')),
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

create trigger trg_seo_meta_updated_at
  before update on public.seo_meta
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique,
  to_path     text not null,
  status_code smallint not null default 301 check (status_code in (301, 302, 307, 308)),
  is_active   boolean not null default true,
  hits        int not null default 0,
  last_hit_at timestamptz,
  created_at  timestamptz not null default now()
);

create index redirects_active_idx on public.redirects (from_path) where is_active;

create table public.not_found_logs (
  path         text primary key,
  hit_count    int not null default 1,
  last_referer text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create index not_found_logs_hits_idx on public.not_found_logs (hit_count desc);

-- ----------------------------------------------------------------------------
-- Audit on-site hebdomadaire (job site-audit)
-- ----------------------------------------------------------------------------

create table public.seo_audits (
  id             uuid primary key default gen_random_uuid(),
  status         text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  pages_scanned  int not null default 0,
  findings_count int not null default 0,
  error          text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create table public.seo_audit_findings (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references public.seo_audits (id) on delete cascade,
  kind        text not null check (kind in
                ('broken_link', 'missing_meta', 'duplicate_title', 'missing_alt', 'thin_content')),
  path        text not null,
  detail      jsonb,
  status      text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index seo_audit_findings_status_idx on public.seo_audit_findings (status, kind);
create index seo_audit_findings_audit_idx on public.seo_audit_findings (audit_id);

create trigger trg_seo_audit_findings_updated_at
  before update on public.seo_audit_findings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Villes : table autonome (route /logiciel-podologue/[ville] + hub)
-- Workflow : seeded → generated → needs_review → approved → published → archived
-- ----------------------------------------------------------------------------

create table public.cities (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  name_locative   text not null, -- « à Lyon », « au Havre », « à La Rochelle »
  dept_code       text not null,
  dept_name       text not null,
  region          text not null,
  population      int,
  lat             double precision,
  lng             double precision,
  wave            smallint not null default 1,
  status          text not null default 'seeded' check (status in
                    ('seeded', 'generated', 'needs_review', 'approved', 'published', 'archived')),
  seo_title       text,
  seo_description text,
  h1              text,
  content         jsonb, -- slots fixes {intro, contexte_local, benefices, meta_description, claims_to_verify[]}
  faq             jsonb, -- 4-6 items dont >= 2 localisés
  generation_id   uuid,  -- FK vers ai_generations(id) ajoutée en 0009
  review_notes    text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index cities_status_idx on public.cities (status, wave);
create index cities_published_idx on public.cities (published_at desc) where status = 'published';
create index cities_region_idx on public.cities (region, name);

create trigger trg_cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

-- Maillage interne « près de {Ville} » (5-6 liens, éditable en admin)
create table public.city_nearby (
  city_id        uuid not null references public.cities (id) on delete cascade,
  nearby_city_id uuid not null references public.cities (id) on delete cascade,
  distance_km    numeric(6, 1),
  position       smallint not null default 0,
  primary key (city_id, nearby_city_id),
  constraint city_nearby_not_self check (city_id <> nearby_city_id)
);

create index city_nearby_city_idx on public.city_nearby (city_id, position);
