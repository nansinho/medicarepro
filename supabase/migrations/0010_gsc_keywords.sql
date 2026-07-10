-- ============================================================================
-- 0010 — Google Search Console + suivi de mots-clés
-- gsc_metrics : totaux par [date] (page='', query='') + détail [page,query].
-- Écritures uniquement via service-role (job gsc-sync, J-3, dataState final).
-- ============================================================================

create table public.gsc_metrics (
  date        date not null,
  page        text not null default '',
  query       text not null default '',
  clicks      int not null default 0,
  impressions int not null default 0,
  ctr         numeric(6, 4) not null default 0,
  position    numeric(6, 2),
  primary key (date, page, query)
);

create index gsc_metrics_page_idx on public.gsc_metrics (page, date desc);
create index gsc_metrics_query_idx on public.gsc_metrics (query, date desc) where query <> '';

-- ----------------------------------------------------------------------------

create table public.gsc_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  date_from     date,
  date_to       date,
  status        text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  rows_upserted int not null default 0,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index gsc_sync_runs_started_idx on public.gsc_sync_runs (started_at desc);

-- Inspection d'URL (couverture d'index des pages villes — job hebdo)
create table public.gsc_url_inspections (
  id              uuid primary key default gen_random_uuid(),
  url             text not null,
  inspected_at    timestamptz not null default now(),
  coverage_state  text, -- ex. « Submitted and indexed », « Crawled - currently not indexed »
  verdict         text, -- PASS / NEUTRAL / FAIL
  last_crawl_time timestamptz
);

create index gsc_url_inspections_url_idx on public.gsc_url_inspections (url, inspected_at desc);

-- ----------------------------------------------------------------------------
-- Mots-clés suivis. source extensible (serp_api) si le client le demande plus tard.
-- ----------------------------------------------------------------------------

create table public.keywords (
  id          uuid primary key default gen_random_uuid(),
  keyword     text not null unique,
  target_path text,
  city_id     uuid references public.cities (id) on delete set null,
  tag         text,
  is_tracked  boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index keywords_tracked_idx on public.keywords (is_tracked, keyword);

create table public.keyword_positions (
  keyword_id  uuid not null references public.keywords (id) on delete cascade,
  date        date not null,
  source      text not null default 'gsc' check (source in ('gsc', 'serp_api')),
  position    numeric(6, 2), -- NULL si aucune impression ce jour-là (limite GSC documentée en UI)
  url_found   text,
  clicks      int not null default 0,
  impressions int not null default 0,
  primary key (keyword_id, date, source)
);

create index keyword_positions_date_idx on public.keyword_positions (date desc);
