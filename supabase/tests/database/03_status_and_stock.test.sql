-- set_order_status() and adjust_stock(): allowed moves, restock once,
-- admin-only.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'staff2@example.test'),
  ('00000000-0000-4000-8000-0000000000b2', 'nobody@example.test');
insert into public.admin_profiles (user_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'Staff Two', 'manager');

create temp table t_orders (k text primary key, ref text, id uuid);
grant all on t_orders to service_role, authenticated;

set local role service_role;
insert into t_orders
select 'a', r.public_ref, null from public.place_order(jsonb_build_object(
  'idempotency_key', '30000000-0000-4000-8000-000000000001',
  'customer_name', 'Status One', 'customer_phone', '01911000001', 'address', 'Road 1, Mirpur', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 3)))) r;
insert into t_orders
select 'b', r.public_ref, null from public.place_order(jsonb_build_object(
  'idempotency_key', '30000000-0000-4000-8000-000000000002',
  'customer_name', 'Status Two', 'customer_phone', '01911000002', 'address', 'Road 2, Mirpur', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 2)))) r;
reset role;
update t_orders t set id = o.id from public.orders o where o.public_ref = t.ref;

select is((select stock from public.product_variants where sku = 'LOS-M'), 7, 'two orders took 5 of 12');

-- Non-admin
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b2';
select throws_ok($$ select public.set_order_status((select id from t_orders where k = 'a'), 'confirmed') $$,
  'P0001', 'FORBIDDEN', 'a non-admin cannot change order status');
select throws_ok($$ select public.adjust_stock('b0000000-0000-4000-8000-000000000301', 5, 'restock') $$,
  'P0001', 'FORBIDDEN', 'a non-admin cannot adjust stock');
reset role;

-- Staff
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b1';

select is(public.set_order_status((select id from t_orders where k = 'a'), 'confirmed', 'Called the customer')::text, 'confirmed', 'pending → confirmed');
select throws_ok($$ select public.set_order_status((select id from t_orders where k = 'a'), 'pending') $$,
  'P0001', 'BAD_TRANSITION', 'cannot move backwards');
select throws_ok($$ select public.set_order_status((select id from t_orders where k = 'a'), 'returned') $$,
  'P0001', 'BAD_TRANSITION', 'cannot return an order that was never shipped');
select is(public.set_order_status((select id from t_orders where k = 'a'), 'cancelled')::text, 'cancelled', 'confirmed → cancelled');
select is((select stock from public.product_variants where sku = 'LOS-M'), 10, 'cancelling put 3 back');
select throws_ok($$ select public.set_order_status((select id from t_orders where k = 'a'), 'confirmed') $$,
  'P0001', 'BAD_TRANSITION', 'cancelled is final');
select is((select stock from public.product_variants where sku = 'LOS-M'), 10, 'stock is not released twice');

select lives_ok($$ select public.set_order_status((select id from t_orders where k = 'b'), 'shipped') $$, 'skipping forward to shipped is allowed');
select lives_ok($$ select public.set_order_status((select id from t_orders where k = 'b'), 'delivered') $$, 'shipped → delivered');
select lives_ok($$ select public.set_order_status((select id from t_orders where k = 'b'), 'returned', 'Customer refused size') $$, 'delivered → returned');
select is((select stock from public.product_variants where sku = 'LOS-M'), 12, 'the return put 2 back');

select throws_ok($$ select public.adjust_stock('b0000000-0000-4000-8000-000000000301', -50, 'adjust', 'count') $$,
  'P0001', 'NEGATIVE_STOCK', 'adjust_stock cannot push stock below zero');
select is(public.adjust_stock('b0000000-0000-4000-8000-000000000301', -1, 'adjust', 'Damaged on return'), 11,
  'a write-off reduces stock and returns the new value');

reset role;
select * from finish();
rollback;
