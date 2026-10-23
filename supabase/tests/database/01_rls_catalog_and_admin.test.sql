-- Who can read and write what. Uses the seed data (supabase db reset).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

-- Test accounts
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'staff@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'someone@example.test'),
  ('00000000-0000-4000-8000-0000000000a4', 'support@example.test');
insert into public.admin_profiles (user_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'Test Owner', 'super_admin'),
  ('00000000-0000-4000-8000-0000000000a2', 'Test Manager', 'manager'),
  ('00000000-0000-4000-8000-0000000000a4', 'Test Support', 'support');

-- A real order so order-table reads have something to hide.
set local role service_role;
select public.place_order(jsonb_build_object(
  'idempotency_key', '10000000-0000-4000-8000-000000000001',
  'customer_name', 'RLS Test', 'customer_phone', '01711000001',
  'address', 'House 1, Road 1', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 1))));
reset role;

-- ------------------------------------------------------------ visitor
create temp table t_published as select count(*)::int as n from public.products where status = 'published';
grant select on t_published to anon;
set local role anon;
set local request.jwt.claim.sub = '';

select is((select count(*)::int from public.products), (select n from t_published), 'visitor sees every published product');
select is((select count(*)::int from public.products where slug = 'draft-sample-top'), 0, 'visitor cannot see a draft product');
select is((select count(*)::int from public.product_variants where sku = 'DST-1'), 0, 'visitor cannot see variants of a draft product');
select throws_ok($$ select * from public.orders $$, '42501', null, 'visitor cannot read orders');
select throws_ok($$ select * from public.admin_profiles $$, '42501', null, 'visitor cannot read admin profiles');
select throws_ok(
  $$ insert into public.products (name, slug, base_price) values ('Hack', 'hack', 1) $$,
  '42501', null, 'visitor cannot insert products');

-- ------------------------------------------- signed in, but not an admin
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a3';

select is((select count(*)::int from public.orders), 0, 'a non-admin account reads no orders');
select throws_ok(
  $$ insert into public.products (name, slug, base_price) values ('Hack', 'hack', 1) $$,
  '42501', null, 'a non-admin account cannot insert products (RLS)');
update public.store_settings set store_name = 'Hacked' where id = 1;
select is((select store_name from public.store_settings where id = 1), 'Sidraa', 'a non-admin account cannot change settings');

-- ------------------------------------------------------------- staff
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a2';

select is((select count(*)::int from public.orders where customer_name = 'RLS Test'), 1, 'manager can read orders');
select is((select count(*)::int from public.products where slug = 'draft-sample-top'), 1, 'manager can see drafts');
select lives_ok(
  $$ insert into public.products (name, slug, base_price) values ('Staff Product', 'staff-product', 500) $$,
  'manager can create a product');
select throws_ok(
  $$ update public.product_variants set stock = 999 where sku = 'RST-S' $$,
  '42501', null, 'staff cannot write stock directly');
select throws_ok(
  $$ insert into public.product_variants (product_id, sku, stock) values ('a0000000-0000-4000-8000-000000000006', 'X-1', 50) $$,
  '42501', null, 'a new variant cannot be created with stock');
update public.store_settings set store_name = 'Staff Name' where id = 1;
select is((select store_name from public.store_settings where id = 1), 'Sidraa', 'manager cannot change store settings');

-- ------------------------------------------------------------- support
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a4';
select is((select count(*)::int from public.orders where customer_name = 'RLS Test'), 1, 'support can read orders');
select throws_ok(
  $$ insert into public.products (name, slug, base_price) values ('Support Product', 'support-product', 500) $$,
  '42501', null, 'support cannot create products (no catalog permission)');
delete from public.products where slug = 'silk-feel-scarf';
select is((select count(*)::int from public.products where slug = 'silk-feel-scarf'), 1, 'support cannot delete products');
select throws_ok($$ select public.report_summary(current_date - 7, current_date) $$, 'P0001', 'FORBIDDEN', 'support cannot see sales reports');
select throws_ok($$ select public.adjust_stock('b0000000-0000-4000-8000-000000000301', 5, 'restock') $$, 'P0001', 'FORBIDDEN', 'support cannot restock');
select is(public.my_permissions() -> 'role', '"support"'::jsonb, 'my_permissions reports the role');
select is(public.has_permission('store_settings'), false, 'support has no store_settings permission');

-- ------------------------------------------------------------- owner
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';

delete from public.products where slug = 'ruffle-sleeve-top';
select is((select count(*)::int from public.products where slug = 'ruffle-sleeve-top'), 1,
  'owner cannot delete a product that an order references');
delete from public.products where slug = 'silk-feel-scarf';
select is((select count(*)::int from public.products where slug = 'silk-feel-scarf'), 0,
  'owner can delete a product with no orders');

-- --------------------------------------------- two-factor enforcement
reset role;
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-4000-8000-0000000000a2', 'verified');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a2';
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a2", "aal": "aal1"}';
select is(public.is_admin(), false, 'staff with a verified TOTP factor is not admin on a password-only (aal1) session');
select is((select count(*)::int from public.orders), 0, '...and reads no orders');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a2", "aal": "aal2"}';
select is(public.is_admin(), true, 'the same staff member is admin after entering the code (aal2)');
select is(public.has_permission('catalog'), true, '...and has their permissions back');

reset role;
select * from finish();
rollback;
