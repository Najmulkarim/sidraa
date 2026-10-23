-- Reports count delivered revenue only, and only admins can run them.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'rep-owner@example.test'),
  ('00000000-0000-4000-8000-0000000000d2', 'rep-nobody@example.test');
insert into public.admin_profiles (user_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'Report Owner', 'super_admin');

create temp table t_ref (k text, ref text);
grant all on t_ref to service_role, authenticated;

set local role service_role;
insert into t_ref select 'd', r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', '50000000-0000-4000-8000-000000000001', 'customer_name', 'Delivered One', 'customer_phone', '01611000001',
  'address', 'Road 5, Banani', 'district', 'Dhaka', 'zone_id', '0b6c3c2e-0000-4000-8000-000000000003',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 1)))) r;
insert into t_ref select 'p', r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', '50000000-0000-4000-8000-000000000002', 'customer_name', 'Pending One', 'customer_phone', '01611000002',
  'address', 'Road 6, Banani', 'district', 'Dhaka', 'zone_id', '0b6c3c2e-0000-4000-8000-000000000003',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000402', 'quantity', 1)))) r;
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
select public.set_order_status(o.id, 'delivered') from public.orders o join t_ref t on t.ref = o.public_ref where t.k = 'd';

select is((public.report_summary(current_date - 1, current_date + 1)->>'orders_placed')::int, 2, 'both orders count as placed');
select is((public.report_summary(current_date - 1, current_date + 1)->>'delivered_revenue')::numeric, 1020::numeric,
  'only the delivered order (890 + 130) counts as revenue');
select is((select units from public.report_products(current_date - 1, current_date + 1) where product_name = 'Ruffle Sleeve Top'), 1::bigint,
  'product report counts delivered units only');
select throws_ok($$ select public.report_summary(current_date, current_date - 5) $$, 'P0001', 'INVALID_INPUT', 'a reversed range is refused');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d2';
select throws_ok($$ select public.report_summary(current_date, current_date) $$, 'P0001', 'FORBIDDEN', 'a non-admin cannot run reports');
reset role;
set local role anon;
select throws_ok($$ select public.dashboard_stats() $$, '42501', null, 'anon cannot run the dashboard query');
reset role;

select * from finish();
rollback;
