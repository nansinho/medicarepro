-- ============================================================================
-- 0006 — Formulaires publics : contacts, newsletter, rate limiting Postgres
-- Écritures publiques UNIQUEMENT via service-role (API routes) — aucun accès anon.
-- ============================================================================

create table public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         citext not null,
  phone         text,
  practitioners text,
  message       text not null,
  consent       boolean not null default false,
  status        text not null default 'new'
                  check (status in ('new', 'in_progress', 'replied', 'closed', 'spam')),
  assigned_to   uuid references public.profiles (id) on delete set null,
  source        text,
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index contact_requests_status_idx on public.contact_requests (status, created_at desc);
create index contact_requests_created_idx on public.contact_requests (created_at desc);

create trigger trg_contact_requests_updated_at
  before update on public.contact_requests
  for each row execute function public.set_updated_at();

create table public.contact_request_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index contact_request_notes_request_idx
  on public.contact_request_notes (request_id, created_at);

-- ----------------------------------------------------------------------------

create table public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token   uuid not null default gen_random_uuid(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status, created_at desc);

-- ----------------------------------------------------------------------------
-- Rate limiting Postgres (pas de Redis) : fenêtres fixes par bucket.
-- Appelée server-side (service-role) : hit_rate_limit('contact:1.2.3.4', 5, 3600)
-- → false si la limite est dépassée pour la fenêtre courante.
-- ----------------------------------------------------------------------------

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket, window_start)
);

create or replace function public.hit_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  -- Fenêtre fixe : arrondi de l'epoch au multiple de p_window_seconds.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = rl.count + 1
  returning rl.count into v_count;

  -- GC opportuniste (~2 % des appels) : purge des fenêtres de plus d'un jour.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

comment on function public.hit_rate_limit(text, int, int) is
  'Incrémente le compteur du bucket pour la fenêtre courante ; false si limite dépassée.';

-- Exécutable uniquement par le service-role (appels server-only).
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
