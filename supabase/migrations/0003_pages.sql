-- ============================================================================
-- 0003 — Cœur du CMS : pages, page_sections, revisions
-- pages.kind : managed (11 pages designées, slots fixes) | composed (composeur)
-- page_sections.content = version publiée ; draft = brouillon (autosave)
-- ============================================================================

create table public.pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  kind         text not null default 'managed' check (kind in ('managed', 'composed')),
  title        text not null,
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index pages_status_idx on public.pages (status, published_at desc);

create trigger trg_pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.page_sections (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages (id) on delete cascade,
  section_key text not null,
  position    int not null default 0,
  type        text not null,
  content     jsonb not null,
  draft       jsonb,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint page_sections_content_type_check check (content ->> 'type' = type),
  constraint page_sections_page_key_unique unique (page_id, section_key)
);

comment on column public.page_sections.content is
  'Payload publié (jsonb, validé zod côté app, discriminant = type, versionné _v).';
comment on column public.page_sections.draft is
  'Brouillon non publié (autosave). Invisible pour anon (privilèges de colonnes, cf. 0012).';

create index page_sections_page_idx on public.page_sections (page_id, position);

create trigger trg_page_sections_updated_at
  before update on public.page_sections
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- revisions : snapshots pour rollback 1 clic (pages, sections, posts, villes…)
-- ----------------------------------------------------------------------------

create table public.revisions (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   uuid not null,
  snapshot    jsonb not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index revisions_entity_idx on public.revisions (entity_type, entity_id, created_at desc);
