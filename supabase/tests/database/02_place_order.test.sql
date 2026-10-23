-- place_order(): server pricing, price tampering, duplicates, stock,
-- validation. Uses seed data.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create temp table t_result (public_ref text, total numeric, created boolean);
grant all on t_result to service_role;

set local role service_role;

-- 1. A normal order, with tampered prices in the payload.
insert into t_result
select * from public.place_order(jsonb_build_object(
  'idempotency_key', '20000000-0000-4000-8000-000000000001',
  'customer_name', '  Rina Akter ', 'customer_phone', '+880 1711-222333',
  'address', 'House 7, Road 3, Dhanmondi', 'district', 'Dhaka', 'area', 'Dhanmondi',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'subtotal', 1, 'total', 1, 'delivery_charge', 0,
  'items', jsonb_build_array(
    jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000102', 'quantity', 1, 'unit_price', 1),
    jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000104', 'quantity', 1, 'price', 1),
    jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000102', 'quantity', 1))), 'iphash');

select is((select created from t_result), true, 'order is created');
select matches((select public_ref from t_result), '^SD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$', 'reference is PREFIX-XXXX-XXXX in Crockford base32');
-- 2 × 2450 (M, product price) + 1 × 2550 (XL, variant price) = 7450; free delivery over 3000 inside Dhaka
select is((select subtotal from public.orders where public_ref = (select public_ref from t_result)), 7450.00::numeric(12,2),
  'subtotal is priced from the database, ignoring the prices sent');
select is((select delivery_charge from public.orders where public_ref = (select public_ref from t_result)), 0.00::numeric(12,2),
  'delivery is free once the subtotal reaches the zone''s free_over');
select is((select total from t_result), 7450::numeric, 'returned total matches');
select is((select customer_phone from public.orders where public_ref = (select public_ref from t_result)), '01711222333',
  'phone is normalised to 01XXXXXXXXX');
select is((select customer_name from public.orders where public_ref = (select public_ref from t_result)), 'Rina Akter', 'name is trimmed');
select is((select count(*)::int from public.order_items oi join public.orders o on o.id = oi.order_id
            where o.public_ref = (select public_ref from t_result)), 2, 'duplicate variant lines are merged into one item');
select is((select stock from public.product_variants where sku = 'FMD-M'), 8, 'stock of FMD-M went from 10 to 8');
select is((select stock from public.product_variants where sku = 'FMD-XL'), 1, 'stock of FMD-XL went from 2 to 1');
select is((select count(*)::int from public.inventory_movements m join public.orders o on o.id = m.order_id
            where o.public_ref = (select public_ref from t_result) and m.reason = 'order'), 2, 'one movement per variant');
select is((select to_status::text from public.order_status_history h join public.orders o on o.id = h.order_id
            where o.public_ref = (select public_ref from t_result)), 'pending', 'history starts at pending');

-- 2. Same idempotency key again → same order, no second decrement.
select is(
  (select row(r.public_ref, r.created)::text from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000001',
    'customer_name', 'Rina Akter', 'customer_phone', '01711222333',
    'address', 'House 7, Road 3, Dhanmondi', 'district', 'Dhaka',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000102', 'quantity', 2)))) r),
  row((select public_ref from t_result), false)::text,
  'a repeated submission returns the first order');
select is((select stock from public.product_variants where sku = 'FMD-M'), 8, 'the repeat did not take stock again');
select is((select count(*)::int from public.orders where idempotency_key = '20000000-0000-4000-8000-000000000001'), 1, 'only one order exists for the key');

-- 3. Paid delivery below the threshold, outside Dhaka (no free_over).
select is(
  (select r.total from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000002',
    'customer_name', 'Joy Das', 'customer_phone', '01822222222',
    'address', 'Station Road, Sylhet', 'district', 'Sylhet',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000003',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000601', 'quantity', 2)))) r),
  1310::numeric, '2 × 590 + 130 delivery = 1310');

-- 4. Errors
select throws_ok($$ select * from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000003',
    'customer_name', 'Too Many', 'customer_phone', '01711000003', 'address', 'Somewhere 12', 'district', 'Dhaka',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000104', 'quantity', 2)))) $$,
  'P0001', 'OUT_OF_STOCK', 'ordering more than the stock left is refused');
select throws_ok($$ select * from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000004',
    'customer_name', 'Draft Buyer', 'customer_phone', '01711000004', 'address', 'Somewhere 12', 'district', 'Dhaka',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000701', 'quantity', 1)))) $$,
  'P0001', 'OUT_OF_STOCK', 'a draft product cannot be ordered');
select throws_ok($$ select * from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000005',
    'customer_name', 'Bad Phone', 'customer_phone', '0171', 'address', 'Somewhere 12', 'district', 'Dhaka',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000601', 'quantity', 1)))) $$,
  'P0001', 'INVALID_INPUT', 'an invalid phone number is refused');
select throws_ok($$ select * from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000006',
    'customer_name', 'Bad Qty', 'customer_phone', '01711000006', 'address', 'Somewhere 12', 'district', 'Dhaka',
    'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000601', 'quantity', -3)))) $$,
  'P0001', 'INVALID_INPUT', 'a negative quantity is refused');
select throws_ok($$ select * from public.place_order(jsonb_build_object(
    'idempotency_key', '20000000-0000-4000-8000-000000000007',
    'customer_name', 'No Zone', 'customer_phone', '01711000007', 'address', 'Somewhere 12', 'district', 'Dhaka',
    'zone_id', 'not-a-uuid',
    'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000601', 'quantity', 1)))) $$,
  'P0001', 'ZONE_INVALID', 'an unknown delivery zone is refused');

reset role;
set local role anon;
select throws_ok($$ select * from public.place_order('{}'::jsonb) $$, '42501', null, 'anon cannot call place_order through the API');

reset role;
select * from finish();
rollback;
