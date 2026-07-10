-- ============================================================================
-- 0002 — Helpers de rôle JWT + profiles (miroir des utilisateurs auth)
-- Rôle réel = auth.users.raw_app_meta_data->>'role' (embarqué dans le JWT).
-- profiles.role n'est qu'un miroir pratique pour l'UI admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers RLS : lisent le rôle applicatif depuis le JWT (app_metadata.role).
-- ----------------------------------------------------------------------------

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_role() = 'admin'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.jwt_role() in ('admin', 'editor')
$$;

comment on function public.jwt_role() is
  'Rôle applicatif depuis auth.jwt()->app_metadata->>role ('''' si absent).';

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           citext not null unique,
  display_name    text,
  role            text not null default 'editor' check (role in ('admin', 'editor')),
  avatar_media_id uuid, -- FK vers media(id) ajoutée en 0007 (media n'existe pas encore)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'Miroir des utilisateurs auth.users (rôle autoritaire = app_metadata du JWT).';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Création automatique du profil à l''insertion d''un utilisateur auth
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case
      when new.raw_app_meta_data ->> 'role' in ('admin', 'editor')
        then new.raw_app_meta_data ->> 'role'
      else 'editor'
    end
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
