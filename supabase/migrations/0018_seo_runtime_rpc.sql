-- ============================================================================
-- 0018 — RPC du runtime SEO : compteurs de redirections + log des 404.
--
-- Appelées par le serveur du site (service_role UNIQUEMENT) depuis le
-- catch-all / les notFound() des routes dynamiques. Les policies anon de
-- lecture (redirects actifs, cities publiées) existent déjà en 0012 —
-- rien à ajouter ici côté SELECT.
-- ============================================================================

-- Incrément atomique du compteur d'une redirection servie.
create or replace function public.record_redirect_hit(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.redirects
  set hits = hits + 1, last_hit_at = now()
  where id = p_id;
$$;

revoke all on function public.record_redirect_hit(uuid) from public, anon, authenticated;
grant execute on function public.record_redirect_hit(uuid) to service_role;

-- Upsert d'un 404 : première vue ou incrément + fraîcheur du referer.
-- Le chemin est tronqué (500) pour éviter le flood par URLs fabriquées.
create or replace function public.record_not_found(p_path text, p_referer text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.not_found_logs (path, hit_count, last_referer, first_seen, last_seen)
  values (left(p_path, 500), 1, left(p_referer, 500), now(), now())
  on conflict (path) do update
    set hit_count    = not_found_logs.hit_count + 1,
        last_seen    = now(),
        last_referer = coalesce(excluded.last_referer, not_found_logs.last_referer);
$$;

revoke all on function public.record_not_found(text, text) from public, anon, authenticated;
grant execute on function public.record_not_found(text, text) to service_role;
