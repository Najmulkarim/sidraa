-- Roles matrix and staff, coupons, block list, full order edit, manual
-- orders, customers, courier booking / sync, secret settings.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(59);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'boss@example.test'),
  ('00000000-0000-4000-8000-0000000000f2', 'manager@example.test'),
  ('00000000-0000-4000-8000-0000000000f3', 'support@example.test'),
  ('00000000-0000-4000-8000-0000000000f4', 'new-hire@example.test');
insert into public.admin_profiles (user_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000f1', 'Boss', 'super_admin'),
  ('00000000-0000-4000-8000-0000000000f2', 'Mina', 'manager'),
  ('00000000-0000-4000-8000-0000000000f3', 'Sumi', 'support');

create temp table t_x (k text primary key, v text);
grant all on t_x to service_role, authenticated;

-- ------------------------------------------------------------ coupons
insert into public.coupons (code, kind, value, min_subtotal, max_discount, usage_limit) values
  ('EID10', 'percent', 10, 1000, 300, 1),
  ('FLAT100', 'fixed', 100, 0, null, null);
insert into public.coupons (code, kind, value, ends_at, starts_at) values ('OLD', 'fixed', 50, now() - interval '1 day', now() - interval '9 days');

set local role anon;
select is((public.quote_order(jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 2)),
          '0b6c3c2e-0000-4000-8000-000000000001', 'eid10') ->> 'discount')::numeric, 258::numeric,
  'quote: 10% of 2580 = 258 (code is case-insensitive)');
select is((public.quote_order(jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000501', 'quantity', 2)),
          '0b6c3c2e-0000-4000-8000-000000000001', 'EID10') ->> 'discount')::numeric, 300::numeric,
  'quote: percent discount is capped by max_discount');
select is(public.quote_order(jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 1)),
          '0b6c3c2e-0000-4000-8000-000000000001', 'EID10') -> 'coupon' ->> 'error',
  'Add items worth ৳1000 or more to use this code', 'quote: minimum order is explained');
select is(public.quote_order(jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 1)),
          '0b6c3c2e-0000-4000-8000-000000000001', 'OLD') -> 'coupon' ->> 'error', 'This code has expired', 'quote: expired code');
select throws_ok($$ select * from public.coupons $$, '42501', null, 'visitors cannot read the coupon table');
reset role;

set local role service_role;
insert into t_x select 'c1', r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', '70000000-0000-4000-8000-000000000001', 'coupon_code', 'EID10',
  'customer_name', 'Coupon Buyer', 'customer_phone', '01733000001', 'address', 'Road 9, Uttara', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 2)))) r;
reset role;
select results_eq($$ select subtotal, discount, delivery_charge, total, coupon_code from public.orders where public_ref = (select v from t_x where k = 'c1') $$,
  $$ values (2580.00::numeric(12,2), 258.00::numeric(12,2), 70.00::numeric(12,2), 2392.00::numeric(12,2), 'EID10') $$,
  'order: discount applied on the server and stored with the code');
select is((select used_count from public.coupons where code = 'EID10'), 1, 'coupon use is counted');
set local role service_role;
select throws_ok($$ select public.place_order(jsonb_build_object(
  'idempotency_key', '70000000-0000-4000-8000-000000000002', 'coupon_code', 'EID10',
  'customer_name', 'Coupon Buyer', 'customer_phone', '01733000002', 'address', 'Road 9, Uttara', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 2)))) $$,
  'P0001', 'COUPON_INVALID', 'a used-up coupon refuses the order (nothing is charged silently)');
reset role;

-- ----------------------------------------------------------- block list
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f3';
select lives_ok($$ select public.block_phone('+880 1733-000009', 'Fake orders twice') $$, 'support can block a number (customers permission)');
reset role;
set local role service_role;
select throws_ok($$ select public.place_order(jsonb_build_object(
  'idempotency_key', '70000000-0000-4000-8000-000000000003',
  'customer_name', 'Blocked', 'customer_phone', '01733000009', 'address', 'Road 9, Uttara', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 1)))) $$,
  'P0001', 'BLOCKED', 'a blocked number cannot order online');
-- an order to edit later: 2 × RST-S
insert into t_x select 'e1', r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', '70000000-0000-4000-8000-000000000004',
  'customer_name', 'Edit Me', 'customer_phone', '01733000004', 'address', 'Road 1, Mirpur', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 2)))) r;
reset role;
insert into t_x select 'e1id', id::text from public.orders where public_ref = (select v from t_x where k = 'e1');

-- ------------------------------------------------------ full order edit
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f3';
select throws_ok($$ select public.admin_save_order((select v::uuid from t_x where k = 'e1id'), '{}'::jsonb) $$,
  'P0001', 'FORBIDDEN', 'support cannot edit order items (orders_edit)');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f2';
select lives_ok($$ select public.admin_save_order((select v::uuid from t_x where k = 'e1id'), jsonb_build_object(
  'customer_name', 'Edit Me', 'customer_phone', '01733000004', 'address', 'Road 1, Mirpur 10', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000003', 'discount', 50, 'source', 'facebook',
  'items', jsonb_build_array(
    jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 1),
    jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 2, 'unit_price', 800)))) $$,
  'manager edits items, sizes, custom price, area and discount');
select results_eq($$ select subtotal, discount, delivery_charge, total, zone_name, source from public.orders where id = (select v::uuid from t_x where k = 'e1id') $$,
  $$ values (2490.00::numeric(12,2), 50.00::numeric(12,2), 130.00::numeric(12,2), 2570.00::numeric(12,2), 'Outside Dhaka', 'facebook') $$,
  'totals recalculated: 890 + 2×800 − 50 + 130');
select is((select stock from public.product_variants where sku = 'RST-S'), 14, 'RST-S: one unit given back (15 − 2 + 1)');
select is((select stock from public.product_variants where sku = 'RST-M'), 1, 'RST-M: two units taken (3 − 2)');
select is((select count(*)::int from public.inventory_movements where order_id = (select v::uuid from t_x where k = 'e1id') and reason = 'edit'), 2,
  'both stock changes are logged as edit movements');
select throws_ok($$ select public.admin_save_order((select v::uuid from t_x where k = 'e1id'), jsonb_build_object(
  'customer_name', 'Edit Me', 'customer_phone', '01733000004', 'address', 'Road 1, Mirpur 10', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000003',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 4)))) $$,
  'P0001', 'OUT_OF_STOCK', 'cannot add more than stock + what the order already holds (1 + 2 < 4)');
select lives_ok($$ select public.admin_save_order((select v::uuid from t_x where k = 'e1id'), jsonb_build_object(
  'customer_name', 'Edit Me', 'customer_phone', '01733000004', 'address', 'Road 1, Mirpur 10', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000003', 'delivery_charge', 0,
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 3)))) $$,
  'exactly stock + held is allowed; delivery charge can be overridden');
select results_eq($$ select total, delivery_charge from public.orders where id = (select v::uuid from t_x where k = 'e1id') $$,
  $$ values (2400.00::numeric(12,2), 0.00::numeric(12,2)) $$, 'custom price kept for the variant (3 × 800), free delivery');
select is((select stock from public.product_variants where sku = 'RST-S') + (select stock from public.product_variants where sku = 'RST-M'), 15 + 0,
  'stock adds up: RST-S back to 15, RST-M 0');
select throws_ok($$ select public.admin_save_order((select v::uuid from t_x where k = 'e1id'), jsonb_build_object(
  'customer_name', 'Edit Me', 'customer_phone', '01733000004', 'address', 'Road 1, Mirpur 10', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000003', 'discount', 99999,
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 3)))) $$,
  'P0001', 'INVALID_INPUT', 'discount above the items total is refused');

-- manual order, idempotent
select is((select count(*)::int from (
  select public.admin_save_order(null, jsonb_build_object('idempotency_key', '70000000-0000-4000-8000-0000000000aa',
    'customer_name', 'Phone Caller', 'customer_phone', '01733000077', 'address', 'Village Road, Bogura', 'district', 'Bogura',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000003', 'source', 'phone', 'status', 'confirmed',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 1))))
  union all
  select public.admin_save_order(null, jsonb_build_object('idempotency_key', '70000000-0000-4000-8000-0000000000aa',
    'customer_name', 'Phone Caller', 'customer_phone', '01733000077', 'address', 'Village Road, Bogura', 'district', 'Bogura',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000003', 'source', 'phone', 'status', 'confirmed',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000301', 'quantity', 1))))) x), 2,
  'manual order call returns twice…');
select results_eq($$ select count(*)::int, min(status::text), min(source), min(total) from public.orders where customer_phone = '01733000077' $$,
  $$ values (1, 'confirmed', 'phone', 1420.00::numeric(12,2)) $$, '…but creates one confirmed phone order (1290 + 130)');
select is((select assigned_to from public.orders where customer_phone = '01733000077'), '00000000-0000-4000-8000-0000000000f2'::uuid,
  'the manual order is assigned to whoever took it');

-- ------------------------------------------------------------ customers
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f3';
select is((select blocked from public.customers_list('01733000004') limit 1), false, 'customers list finds by phone');
select is((select count(*)::int from public.customers_list(null, 'blocked')), 0, 'blocked filter only shows customers with orders who are blocked');
select is((select name from public.customers_list('phone call') limit 1), 'Phone Caller', 'customers list finds by name');

-- --------------------------------------------------------------- courier
reset role;
insert into t_x values ('e2id', (select id::text from public.orders where customer_phone = '01733000077'));
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f3';
select is((public.begin_courier_send((select v::uuid from t_x where k = 'e2id')) ->> 'cod_amount')::numeric, 1420::numeric,
  'begin_courier_send returns the amount to collect from the database');
select throws_ok($$ select public.begin_courier_send((select v::uuid from t_x where k = 'e2id')) $$, 'P0001', 'BUSY',
  'a second send within two minutes is refused (no double booking)');
select lives_ok($$ select public.record_courier_booking((select v::uuid from t_x where k = 'e2id'), 'steadfast', '9911', 'SFR1', 'in_review', null) $$,
  'booking recorded');
select results_eq($$ select status::text, courier, courier_consignment_id from public.orders where id = (select v::uuid from t_x where k = 'e2id') $$,
  $$ values ('shipped', 'steadfast', '9911') $$, 'the order is now with the courier');
select throws_ok($$ select public.begin_courier_send((select v::uuid from t_x where k = 'e2id')) $$, 'P0001', 'ALREADY_SENT', 'cannot send twice');
select throws_ok($$ select public.apply_courier_status('steadfast', '9911', 'delivered') $$, '42501', null, 'staff cannot fake a courier update');
select throws_ok($$ select * from public.courier_settings $$, '42501', null, 'courier keys are not readable by staff');
select throws_ok($$ select public.get_courier_settings() $$, 'P0001', 'FORBIDDEN', 'support cannot open courier settings');
select is(public.courier_options() ->> 'steadfast', 'false', 'support sees which couriers are ready, without keys');
select is(public.dashboard_stats() -> 'today_delivered_revenue', 'null'::jsonb, 'support dashboard hides money (no revenue permission)');
reset role;

set local role service_role;
select is(public.apply_courier_status('steadfast', '9911', 'hold') ->> 'status', 'shipped', 'courier hold: still shipped');
select is(public.apply_courier_status('steadfast', '9911', 'delivered_approval_pending', 60) ->> 'status', 'delivered', 'courier delivered → delivered');
select is(public.apply_courier_status('steadfast', 'nope', 'delivered') ->> 'found', 'false', 'unknown consignment is ignored');
reset role;
select results_eq($$ select paid_amount, courier_charge from public.orders where id = (select v::uuid from t_x where k = 'e2id') $$,
  $$ values (1420.00::numeric(12,2), 60.00::numeric(12,2)) $$, 'delivered: paid in full, courier charge stored');
select is(public.courier_status_to_order('Pickup_Cancelled'), 'returned'::public.order_status, 'Pathao pickup cancelled → returned');
select is(public.courier_status_to_order('order.partial_delivery'), 'delivered'::public.order_status, 'Pathao partial delivery event → delivered');
select is(public.courier_status_to_order('In_Transit'), null, 'in transit → no change');

-- ------------------------------------------------------ secret settings
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f1';
select lives_ok($$ select public.save_courier_settings('{"default_courier":"steadfast","steadfast_api_key":"abcdefgh1234","steadfast_secret_key":"s3cr3tvalue"}') $$, 'super admin saves courier keys');
select is(public.get_courier_settings() ->> 'steadfast_api_key', '••••1234', 'keys come back masked');
select lives_ok($$ select public.save_courier_settings('{"steadfast_api_key":""}') $$, 'saving an empty key…');
select throws_ok($$ select steadfast_api_key from public.courier_settings $$, '42501', null, '…(even a super admin cannot select the raw keys)');
reset role;
select is((select steadfast_api_key from public.courier_settings), 'abcdefgh1234', '…and the stored key is kept');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f1';
select lives_ok($$ select public.save_marketing_settings('{"fb_pixel_id":"123456789012345","capi_enabled":true,"capi_token":"EAAtoken9876"}') $$, 'super admin saves pixel and CAPI');
select is((select fb_pixel_id from public.store_settings), '123456789012345', 'pixel id is public (used by the shop)');
select is(public.get_marketing_settings() ->> 'capi_token', '••••9876', 'CAPI token comes back masked');
select is(public.courier_options() ->> 'steadfast', 'true', 'courier ready once keys are saved');

-- ----------------------------------------------------- staff and roles
select lives_ok($$ select public.save_staff('00000000-0000-4000-8000-0000000000f4', 'New Hire', 'support', true) $$, 'super admin adds staff');
select throws_ok($$ select public.save_staff('00000000-0000-4000-8000-0000000000f1', 'Boss', 'manager', true) $$, 'P0001', 'INVALID_INPUT',
  'super admin cannot demote themself');
select lives_ok($$ select public.set_role_permissions('support', array['dashboard', 'orders', 'catalog']) $$, 'super admin edits the support role');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f3';
select is(public.has_permission('catalog'), true, 'support now has catalog…');
select is(public.has_permission('customers'), false, '…and lost customers');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f2';
select throws_ok($$ select public.save_staff('00000000-0000-4000-8000-0000000000f2', 'Mina', 'super_admin', true) $$, 'P0001', 'FORBIDDEN',
  'a manager cannot promote themself');

reset role;
select * from finish();
rollback;
