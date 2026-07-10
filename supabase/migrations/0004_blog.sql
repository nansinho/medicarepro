-- ============================================================================
-- 0004 — Blog : categories, posts, tags, post_tags
-- posts.body = Tiptap JSON canonique ; body_legacy = BlogSection[] d'origine
-- ============================================================================

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  excerpt          text,
  cover_media_id   uuid, -- FK vers media(id) ajoutée en 0007
  cover_alt        text,
  status           text not null default 'draft'
                     check (status in ('draft', 'needs_review', 'approved', 'scheduled', 'published', 'archived')),
  published_at     timestamptz,
  scheduled_for    timestamptz,
  reading_time_min int,
  body             jsonb not null default '{"type": "doc", "content": []}'::jsonb,
  body_legacy      jsonb,
  author_id        uuid references public.profiles (id) on delete set null,
  category_id      uuid references public.categories (id) on delete set null,
  origin           text not null default 'manual' check (origin in ('manual', 'ai')),
  generation_id    uuid, -- FK vers ai_generations(id) ajoutée en 0009
  seo_score        jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.posts.body is 'Document Tiptap JSON (canonique).';
comment on column public.posts.body_legacy is
  'BlogSection[] d''origine (constantes TS), conservé pour rollback de conversion.';

create index posts_status_idx on public.posts (status, published_at desc);
create index posts_scheduled_idx on public.posts (scheduled_for) where status = 'scheduled';
create index posts_category_idx on public.posts (category_id);
create index posts_author_idx on public.posts (author_id);

create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create index post_tags_tag_idx on public.post_tags (tag_id);
