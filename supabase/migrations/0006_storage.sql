-- 0006 — Storage bucket for product and category images.
-- Public read (files are served by URL); admin-only upload / replace /
-- delete; images only, 5 MB max (enforced by the bucket itself).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_bucket_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.has_permission('catalog') or public.has_permission('store_settings')));

create policy product_images_bucket_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.has_permission('catalog') or public.has_permission('store_settings')))
  with check (bucket_id = 'product-images' and (select public.has_permission('catalog') or public.has_permission('store_settings')));

create policy product_images_bucket_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.has_permission('catalog') or public.has_permission('store_settings')));

-- Public buckets serve files without a select policy; this one lets the
-- admin list files from the dashboard API.
create policy product_images_bucket_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.has_permission('catalog') or public.has_permission('store_settings')));
