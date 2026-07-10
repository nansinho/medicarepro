-- ============================================================================
-- 0001 — Extensions + fonction générique updated_at
-- MediCare Pro CMS — chaîne de migrations (rejouable dans l'ordre sur DB vierge)
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Trigger générique : force updated_at = now() à chaque UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger générique BEFORE UPDATE : met à jour la colonne updated_at.';
