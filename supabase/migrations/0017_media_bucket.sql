-- ============================================================================
-- 0017 — Bucket Storage `media` (bibliothèque d'images du CMS) + policies.
--
-- Lecture publique (le site sert les images via l'URL publique du bucket),
-- écriture réservée au staff (admin + éditeur), suppression admin — aligné
-- sur la RLS de la table public.media (0007/0012). Les buckets billing/sepa
-- (0015) restent privés sans policy (service-role + URLs signées).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Lecture : bucket public (URLs /object/public/*) ; la policy couvre en plus
-- le listing via l'API Storage authentifiée.
create policy media_objects_select_public
  on storage.objects for select
  using (bucket_id = 'media');

create policy media_objects_insert_staff
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());

create policy media_objects_update_staff
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());

create policy media_objects_delete_admin
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
