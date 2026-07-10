-- ============================================================================
-- 0005 — Collections réutilisables + menus + site_settings
-- Référencées par les blocs de pages (éditer un témoignage le met à jour partout).
-- ============================================================================

create table public.testimonials (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  role            text,
  avatar_media_id uuid, -- FK vers media(id) ajoutée en 0007
  avatar_path     text, -- chemin legacy /images/… tant que le fichier n'est pas migré
  quote           text not null,
  rating          smallint not null default 5 check (rating between 1 and 5),
  position        int not null default 0,
  published       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index testimonials_published_idx on public.testimonials (published, position);

create trigger trg_testimonials_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.faq_items (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  context    text not null default 'global', -- global | pricing | security | city…
  position   int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faq_items_context_idx on public.faq_items (context, position);

create trigger trg_faq_items_updated_at
  before update on public.faq_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.pricing_plans (
  id         uuid primary key default gen_random_uuid(),
  plan_key   text not null unique check (plan_key in ('monthly', 'annual')),
  name       text not null,
  sub        text,
  price      numeric(8, 2) not null,
  unit       text,
  secondary  text,
  featured   boolean not null default false,
  badge      text,
  cta_label  text,
  features   jsonb not null default '[]'::jsonb,
  position   int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_pricing_plans_updated_at
  before update on public.pricing_plans
  for each row execute function public.set_updated_at();

create table public.pricing_examples (
  id         uuid primary key default gen_random_uuid(),
  config     text not null,
  monthly    numeric(8, 2),
  yearly     numeric(8, 2),
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_pricing_examples_updated_at
  before update on public.pricing_examples
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.feature_items (
  id         uuid primary key default gen_random_uuid(),
  collection text not null default 'features' check (collection in ('features', 'bilans')),
  icon       text, -- clé string résolue via icons.tsx
  kicker     text,
  title      text not null,
  text       text,
  points     jsonb not null default '[]'::jsonb,
  mockup     text, -- MockupKind string
  href       text,
  href_label text,
  position   int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feature_items_collection_idx on public.feature_items (collection, published, position);

create trigger trg_feature_items_updated_at
  before update on public.feature_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------

create table public.menus (
  key        text primary key, -- header | footer_product | footer_resources…
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger trg_menus_updated_at
  before update on public.menus
  for each row execute function public.set_updated_at();

create table public.site_settings (
  key        text primary key, -- identity | contact | socials | legal_entity | robots…
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on column public.site_settings.is_public is
  'true = lisible par anon (rendu public) ; false = back-office uniquement.';

create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();
