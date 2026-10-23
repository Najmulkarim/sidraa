-- Order operations: hold / ship later / fake / lost, paid amount, notes,
-- assignment, soft delete, bulk changes, tab counts, customer stats.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'ops-staff@example.test'),
  ('00000000-0000-4000-8000-0000000000e2', 'ops-other@example.test'),
  ('00000000-0000-4000-8000-0000000000e3', 'ops-nobody@example.test');
insert into public.admin_profiles (user_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'Kumkum', 'manager'),
  ('00000000-0000-4000-8000-0000000000e2', 'Rafi', 'support');

create temp table t_o (k text primary key, ref text, id uuid);
grant all on t_o to service_role, authenticated;

-- Six orders of 1 × Ruffle Sleeve Top S (stock 15), same customer phone.
set local role service_role;
insert into t_o select k, (select r.public_ref from public.place_order(jsonb_build_object(
  'idempotency_key', ('60000000-0000-4000-8000-00000000000' || n)::uuid,
  'customer_name', 'Ops Customer', 'customer_phone', '01722000111', 'address', 'Road 4, Banani', 'district', 'Dhaka',
  'zone_id', '0b6c3c2e-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('variant_id', 'b0000000-0000-4000-8000-000000000401', 'quantity', 1)))) r), null
from (values ('a', 1), ('b', 2), ('c', 3), ('d', 4), ('e', 5), ('f', 6)) v(k, n);
reset role;
update t_o t set id = o.id from public.orders o where o.public_ref = t.ref;

select is((select stock from public.product_variants where sku = 'RST-S'), 9, 'six orders took 6 of 15');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000e1';

-- hold and back
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'a'), 'hold', 'Customer asked to wait') $$, 'pending → hold');
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'a'), 'confirmed') $$, 'hold → confirmed');
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'b'), 'ship_later') $$, 'pending → ship later');
select throws_ok($$ select public.set_order_status((select id from t_o where k = 'b'), 'returned') $$, 'P0001', 'BAD_TRANSITION', 'ship later cannot jump to returned');

-- fake puts stock back, lost does not
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'c'), 'fake') $$, 'pending → fake');
select is((select stock from public.product_variants where sku = 'RST-S'), 10, 'fake order returned its stock');
select throws_ok($$ select public.set_order_status((select id from t_o where k = 'c'), 'confirmed') $$, 'P0001', 'BAD_TRANSITION', 'fake is final');
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'd'), 'shipped') $$, 'pending → shipped');
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'd'), 'lost', 'Courier lost it') $$, 'shipped → lost');
select is((select stock from public.product_variants where sku = 'RST-S'), 10, 'a lost parcel does not come back into stock');

-- delivered = cash collected
select lives_ok($$ select public.set_order_status((select id from t_o where k = 'a'), 'delivered') $$, 'confirmed → delivered');
select is((select paid_amount from public.orders where id = (select id from t_o where k = 'a')), (select total from public.orders where id = (select id from t_o where k = 'a')),
  'delivering sets paid to the full total');
select throws_ok($$ select public.record_payment((select id from t_o where k = 'b'), 99999) $$, 'P0001', 'INVALID_INPUT', 'paid cannot exceed the total');
select is(public.record_payment((select id from t_o where k = 'b'), 500, 'bKash advance'), 500::numeric, 'partial advance recorded');

-- notes
select lives_ok($$ insert into public.order_notes (order_id, body, created_by) values ((select id from t_o where k = 'b'), 'Call after 5 pm', '00000000-0000-4000-8000-0000000000e1') $$, 'staff adds a note');
select throws_ok($$ insert into public.order_notes (order_id, kind, body, created_by) values ((select id from t_o where k = 'b'), 'system', 'Fake system line', '00000000-0000-4000-8000-0000000000e1') $$,
  '42501', null, 'staff cannot write system lines');
select throws_ok($$ insert into public.order_notes (order_id, body, created_by) values ((select id from t_o where k = 'b'), 'Pretending', '00000000-0000-4000-8000-0000000000e2') $$,
  '42501', null, 'a note cannot be written in someone else''s name');

-- assignment
select lives_ok($$ select public.assign_order((select id from t_o where k = 'b'), '00000000-0000-4000-8000-0000000000e2') $$, 'assign to a staff member');
select is((select body from public.order_notes where order_id = (select id from t_o where k = 'b') and kind = 'system' order by id desc limit 1), 'Assigned to Rafi', 'assignment is logged');
select throws_ok($$ select public.assign_order((select id from t_o where k = 'b'), '00000000-0000-4000-8000-0000000000e3') $$, 'P0001', 'NOT_FOUND', 'cannot assign to a non-admin');

-- edit customer
select lives_ok($$ select public.update_order_customer((select id from t_o where k = 'b'), jsonb_build_object('customer_name', 'Ops Customer Two', 'customer_phone', '+8801722000111', 'address', 'Road 9, Banani', 'district', 'Dhaka')) $$,
  'customer details editable before shipping');
select throws_ok($$ select public.update_order_customer((select id from t_o where k = 'd'), jsonb_build_object('customer_name', 'X Y', 'customer_phone', '01722000111', 'address', 'Road 9, Banani', 'district', 'Dhaka')) $$,
  'P0001', 'BAD_TRANSITION', 'not editable once with the courier (or lost)');

-- bulk
select is(public.bulk_set_order_status(array[(select id from t_o where k = 'e'), (select id from t_o where k = 'f'), (select id from t_o where k = 'c')], 'confirmed'),
  '{"done": 2, "skipped": 1}'::jsonb, 'bulk confirm: 2 done, the fake one skipped');

-- soft delete
select lives_ok($$ select public.delete_order((select id from t_o where k = 'e')) $$, 'delete an open order');
select is((select status::text || '/' || (deleted_at is not null)::text from public.orders where id = (select id from t_o where k = 'e')), 'cancelled/true', 'deleting cancels it first and hides it');
select is((select stock from public.product_variants where sku = 'RST-S'), 11, 'deleting returned the stock');
select throws_ok($$ select public.set_order_status((select id from t_o where k = 'e'), 'confirmed') $$, 'P0001', 'BAD_TRANSITION', 'a deleted order cannot change status');

-- page queries
select is((public.order_tab_counts(null, null, null)->>'deleted')::int, 1, 'tab counts include deleted orders separately');
select is((select delivered::text || '/' || failed::text from public.customer_stats(array['01722000111'])), '1/2', 'customer record: 1 delivered, 2 failed (fake, lost); deleted orders do not count');

select is((select count(*)::int from public.list_staff()), 2, 'staff can list active admins for assignment');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000e3';
select throws_ok($$ select * from public.list_staff() $$, 'P0001', 'FORBIDDEN', 'a non-admin cannot list staff');
reset role;
select * from finish();
rollback;
