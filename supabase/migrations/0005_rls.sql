-- 0005 — Row Level Security on every table, plus table/column grants.
-- Visitors read only the published catalogue and public settings.
-- No browser (anon or authenticated) can write orders, history,
-- movements or rate limits; those change only inside the functions in
-- 0007/0008, which run as their owner.

alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.product_variants     enable row level security;
alter table public.store_settings       enable row level security;
alter table public.delivery_zones       enable row level security;
alter table public.admin_profiles       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.inventory_movements  enable row level security;
alter table public.rate_limits          enable row level security;

-- ---------------------------------------------------------------- grants
-- Supabase grants ALL on new public tables to anon and authenticated by
-- default. Narrow that so a missing policy is not the only wall.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.categories, public.products, public.product_images,
                public.product_variants, public.store_settings, public.delivery_zones
  to anon, authenticated;

grant insert, update, delete on public.categories, public.products, public.product_images
  to authenticated;
grant update on public.delivery_zones, public.store_settings to authenticated;
grant insert, delete on public.delivery_zones to authenticated;

-- Variants: stock is never written directly; only through adjust_stock(),
-- place_order() and set_order_status().
grant insert, delete on public.product_variants to authenticated;
grant update (sku, size, color, option3, image_path, price, is_active) on public.product_variants to authenticated;

grant select on public.admin_profiles, public.orders, public.order_items,
                public.order_status_history, public.inventory_movements
  to authenticated;
-- rate_limits: no grants at all for anon/authenticated.

-- ------------------------------------------------------------ categories
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));

create policy categories_admin_insert on public.categories
  for insert to authenticated with check ((select public.has_permission('catalog')));
create policy categories_admin_update on public.categories
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select public.has_permission('catalog')));

-- -------------------------------------------------------------- products
create policy products_public_read on public.products
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy products_admin_insert on public.products
  for insert to authenticated with check ((select public.has_permission('catalog')));
create policy products_admin_update on public.products
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
-- Catalog permission, and only while no order references the product.
create policy products_owner_delete on public.products
  for delete to authenticated
  using (
    (select public.has_permission('catalog'))
    and not exists (select 1 from public.order_items oi where oi.product_id = products.id)
  );

-- -------------------------------------------------------- product_images
create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.products p
               where p.id = product_images.product_id and p.status = 'published')
  );
create policy product_images_admin_insert on public.product_images
  for insert to authenticated with check ((select public.has_permission('catalog')));
create policy product_images_admin_update on public.product_images
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
create policy product_images_admin_delete on public.product_images
  for delete to authenticated using ((select public.has_permission('catalog')));

-- ------------------------------------------------------ product_variants
create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or (is_active and exists (select 1 from public.products p
                              where p.id = product_variants.product_id and p.status = 'published'))
  );
-- New variants start at zero stock; initial stock is added with adjust_stock()
-- so every unit appears in inventory_movements.
create policy product_variants_admin_insert on public.product_variants
  for insert to authenticated with check ((select public.has_permission('catalog')) and stock = 0);
create policy product_variants_admin_update on public.product_variants
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
create policy product_variants_admin_delete on public.product_variants
  for delete to authenticated
  using (
    (select public.has_permission('catalog'))
    and not exists (select 1 from public.order_items oi where oi.variant_id = product_variants.id)
  );

-- -------------------------------------------------------- store_settings
create policy store_settings_public_read on public.store_settings
  for select to anon, authenticated using (true);
create policy store_settings_owner_update on public.store_settings
  for update to authenticated using ((select public.has_permission('store_settings'))) with check ((select public.has_permission('store_settings')));

-- -------------------------------------------------------- delivery_zones
create policy delivery_zones_public_read on public.delivery_zones
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy delivery_zones_owner_insert on public.delivery_zones
  for insert to authenticated with check ((select public.has_permission('store_settings')));
create policy delivery_zones_owner_update on public.delivery_zones
  for update to authenticated using ((select public.has_permission('store_settings'))) with check ((select public.has_permission('store_settings')));
-- Zones referenced by orders are kept (deactivate instead); FK is set null anyway.
create policy delivery_zones_owner_delete on public.delivery_zones
  for delete to authenticated using ((select public.has_permission('store_settings')));

-- -------------------------------------------------------- admin_profiles
-- Read own row; super admin reads all. No write policies: staff are managed
-- through the staff functions in 0011 (super admin only).
create policy admin_profiles_self_read on public.admin_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));

-- ------------------------------------------------- orders and their rows
create policy orders_admin_read on public.orders
  for select to authenticated using ((select public.has_permission('orders')));
create policy order_items_admin_read on public.order_items
  for select to authenticated using ((select public.has_permission('orders')));
create policy order_status_history_admin_read on public.order_status_history
  for select to authenticated using ((select public.has_permission('orders')));
create policy inventory_movements_admin_read on public.inventory_movements
  for select to authenticated using ((select public.has_permission('inventory') or public.has_permission('orders')));

-- ------------------------------------------------ roles and permissions
grant select on public.permissions, public.role_permissions to authenticated;
create policy permissions_admin_read on public.permissions
  for select to authenticated using ((select public.is_admin()));
create policy role_permissions_admin_read on public.role_permissions
  for select to authenticated using ((select public.is_admin()));

-- rate_limits: RLS on, no policies → nobody but the table owner / service role.
