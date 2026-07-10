-- ============================================================================
-- 0007 — Médiathèque + FK différées (profiles/posts/testimonials → media)
-- bucket 'media' = Supabase Storage (public read) ; bucket 'legacy' = fichiers
-- existants servis depuis /public/images (pas de migration de fichiers au lancement).
-- ============================================================================

create table public.media (
  id         uuid primary key default gen_random_uuid(),
  bucket     text not null default 'media',
  path       text not null,
  url        text, -- URL publique résolue (legacy : /images/…)
  alt        text,
  title      text,
  mime       text,
  size_bytes bigint,
  width      int,
  height     int,
  folder     text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_bucket_path_unique unique (bucket, path)
);

create index media_folder_idx on public.media (folder, created_at desc);
create index media_bucket_idx on public.media (bucket);

create trigger trg_media_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- FK différées (media n'existait pas au moment de la création de ces tables)
-- ----------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_avatar_media_id_fkey
  foreign key (avatar_media_id) references public.media (id) on delete set null;

alter table public.posts
  add constraint posts_cover_media_id_fkey
  foreign key (cover_media_id) references public.media (id) on delete set null;

alter table public.testimonials
  add constraint testimonials_avatar_media_id_fkey
  foreign key (avatar_media_id) references public.media (id) on delete set null;
