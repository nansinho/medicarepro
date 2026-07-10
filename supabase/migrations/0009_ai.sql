-- ============================================================================
-- 0009 — Pipeline IA : topics (backlog), briefs, ai_generations (table partagée)
-- ai_generations.kind : article | city_page | meta | topic_suggest
-- L'IA ne publie JAMAIS seule : gate humaine via posts.status / cities.status.
-- ============================================================================

create table public.topics (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  target_keyword     text,
  secondary_keywords text[] not null default '{}',
  source             text not null default 'manual' check (source in ('manual', 'gsc', 'ai')),
  status             text not null default 'backlog'
                       check (status in ('backlog', 'briefed', 'generated', 'discarded')),
  priority           smallint not null default 0,
  notes              text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index topics_status_idx on public.topics (status, priority desc, created_at);

create trigger trg_topics_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.briefs (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid not null references public.topics (id) on delete cascade,
  target_keyword    text not null,
  outline           jsonb, -- plan h2/h3 imposé
  internal_links    jsonb, -- liens internes imposés [{path, anchor}]
  word_count_target int not null default 1100,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index briefs_topic_idx on public.briefs (topic_id);

create trigger trg_briefs_updated_at
  before update on public.briefs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.ai_generations (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('article', 'city_page', 'meta', 'topic_suggest')),
  subject_id           uuid, -- brief_id / city_id / cible selon kind (pas de FK : polymorphe)
  model                text,
  prompt_version       text,
  status               text not null default 'queued'
                         check (status in ('queued', 'running', 'succeeded', 'failed')),
  input                jsonb,
  output               jsonb,
  error                text,
  attempts             int not null default 0,
  input_tokens         int,
  output_tokens        int,
  cost_usd             numeric(8, 4),
  scheduled_publish_at timestamptz,
  claimed_at           timestamptz,
  created_by           uuid references public.profiles (id) on delete set null,
  reviewed_by          uuid references public.profiles (id) on delete set null,
  review_notes         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index ai_generations_status_idx on public.ai_generations (status, created_at);
create index ai_generations_kind_idx on public.ai_generations (kind, created_at desc);

create trigger trg_ai_generations_updated_at
  before update on public.ai_generations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Claim atomique pour le worker (FOR UPDATE SKIP LOCKED) :
-- prend la plus ancienne génération queued, OU une running bloquée > 15 min.
-- Retourne NULL s'il n'y a rien à traiter.
-- ----------------------------------------------------------------------------

create or replace function public.claim_ai_generation()
returns public.ai_generations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gen public.ai_generations;
begin
  select *
    into v_gen
    from public.ai_generations
   where status = 'queued'
      or (status = 'running'
          and coalesce(claimed_at, updated_at) < now() - interval '15 minutes')
   order by created_at
   limit 1
   for update skip locked;

  if v_gen.id is null then
    return null;
  end if;

  update public.ai_generations
     set status = 'running',
         claimed_at = now(),
         attempts = attempts + 1
   where id = v_gen.id
  returning * into v_gen;

  return v_gen;
end;
$$;

-- Exécutable uniquement par le service-role (runner de jobs).
revoke all on function public.claim_ai_generation() from public, anon, authenticated;
grant execute on function public.claim_ai_generation() to service_role;

-- ----------------------------------------------------------------------------
-- FK différées : posts / cities → ai_generations
-- ----------------------------------------------------------------------------

alter table public.posts
  add constraint posts_generation_id_fkey
  foreign key (generation_id) references public.ai_generations (id) on delete set null;

alter table public.cities
  add constraint cities_generation_id_fkey
  foreign key (generation_id) references public.ai_generations (id) on delete set null;
