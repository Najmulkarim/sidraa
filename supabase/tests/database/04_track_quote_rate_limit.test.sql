-- track_order(), quote_order() and hit_rate_limit().
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create temp table t_ref (ref text);
grant all on t_ref to service_role;

set local role service_role;
insert into t_ref
select r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', '40000000-0000-4000-8000-000000000001',
  'customer_name', 'Track Me', 'customer_phone', '01555123456', 'address', 'Secret Street 9, Uttara', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000002',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000501', 'quantity', 1)))) r;

select is((public.track_order((select ref from t_ref), '3456'))->>'status', 'pending', 'correct reference and last 4 digits find the order');
select is((public.track_order(lower(replace((select ref from t_ref), '-', ' ')), '3456'))->>'status', 'pending',
  'reference is accepted in lower case with spaces');
select ok(public.track_order((select ref from t_ref), '0000') is null, 'wrong digits find nothing');
select ok(public.track_order('SD-0000-0000', '3456') is null, 'unknown reference finds nothing');
select ok(
  not (public.track_order((select ref from t_ref), '3456') ?| array['address', 'customer_phone', 'customer_name', 'note', 'district', 'area']),
  'tracking never returns name, phone or address');
select is(jsonb_array_length(public.track_order((select ref from t_ref), '3456')->'items'), 1, 'tracking lists the items');

select ok(public.hit_rate_limit('test:bucket', 2, 600), 'first hit allowed');
select ok(public.hit_rate_limit('test:bucket', 2, 600), 'second hit allowed');
select ok(not public.hit_rate_limit('test:bucket', 2, 600), 'third hit inside the window is refused');
reset role;

set local role anon;
select throws_ok($$ select public.track_order('SD-0000-0000', '1234') $$, '42501', null, 'anon cannot call track_order directly');
select is(
  (public.quote_order(jsonb_build_array(
     jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000203', 'quantity', 1),
     jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000701', 'quantity', 1),
     jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 2)),
   '0b6c3c2e-0000-4000-8000-000000000002')->'lines') @? '$[*] ? (@.state == "sold_out")',
  true, 'quote flags a sold-out size');
select is(
  (public.quote_order(jsonb_build_array(
     jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 2)),
   '0b6c3c2e-0000-4000-8000-000000000002')->>'total')::numeric,
  1880::numeric, 'quote: 2 × 890 + 100 delivery');
reset role;

select * from finish();
rollback;
