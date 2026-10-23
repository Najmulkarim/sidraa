-- Schema-level guarantees: RLS on every table, no write grants for
-- browsers on order tables, server-only functions locked down.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every table in public has row level security enabled'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('orders', 'order_items', 'order_status_history', 'inventory_movements', 'rate_limits')
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0,
  'anon and authenticated hold no write grants on order, history, movement or rate-limit tables'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'rate_limits' and grantee in ('anon', 'authenticated')),
  0,
  'rate_limits is invisible to anon and authenticated'
);

select ok(not has_function_privilege('anon', 'public.place_order(jsonb, text)', 'execute'), 'anon cannot execute place_order');
select ok(not has_function_privilege('authenticated', 'public.place_order(jsonb, text)', 'execute'), 'authenticated cannot execute place_order');
select ok(has_function_privilege('service_role', 'public.place_order(jsonb, text)', 'execute'), 'service_role can execute place_order');
select ok(not has_function_privilege('anon', 'public.track_order(text, text)', 'execute'), 'anon cannot execute track_order');
select ok(not has_function_privilege('anon', 'public.hit_rate_limit(text, int, int)', 'execute'), 'anon cannot execute hit_rate_limit');
select ok(not has_function_privilege('anon', 'public.set_order_status(uuid, public.order_status, text)', 'execute'), 'anon cannot execute set_order_status');
select ok(has_function_privilege('anon', 'public.quote_order(jsonb, uuid, text)', 'execute'), 'anon can request a price quote');
select ok(not has_column_privilege('authenticated', 'public.product_variants', 'stock', 'update'), 'nobody updates variant stock directly');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'every security definer function pins its search_path'
);

select * from finish();
rollback;
