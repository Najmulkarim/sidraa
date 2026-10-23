-- 0009 — dashboard and report queries, plus the optional address
-- redaction job. Report functions run as the caller (security invoker),
-- so RLS still applies; they also refuse non-admins explicitly.
-- Date ranges are whole days in Asia/Dhaka, both ends inclusive.

create or replace function public.dhaka_range(p_from date, p_to date)
returns tstzrange
language sql
immutable
set search_path = ''
as $$
  select tstzrange(
    (p_from::timestamp at time zone 'Asia/Dhaka'),
    ((p_to + 1)::timestamp at time zone 'Asia/Dhaka'),
    '[)');
$$;

create or replace function public.report_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r tstzrange;
  v jsonb;
begin
  perform public.require_permission('revenue');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'range', 'reason', 'Choose a range of up to one year')::text;
  end if;
  r := public.dhaka_range(p_from, p_to);

  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders_placed',      (select count(*) from public.orders where created_at <@ r),
    'orders_placed_value',(select coalesce(sum(total), 0) from public.orders where created_at <@ r),
    'delivered_count',    (select count(*) from public.orders where status = 'delivered' and delivered_at <@ r),
    'delivered_revenue',  (select coalesce(sum(total), 0) from public.orders where status = 'delivered' and delivered_at <@ r),
    'delivered_products', (select coalesce(sum(subtotal), 0) from public.orders where status = 'delivered' and delivered_at <@ r),
    'delivered_delivery', (select coalesce(sum(delivery_charge), 0) from public.orders where status = 'delivered' and delivered_at <@ r),
    'cancelled_count',    (select count(*) from public.orders where status = 'cancelled' and cancelled_at <@ r),
    'returned_count',     (select count(*) from public.orders where status = 'returned' and returned_at <@ r),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d::date,
               'placed', (select count(*) from public.orders o where o.created_at <@ public.dhaka_range(d::date, d::date)),
               'delivered_revenue', (select coalesce(sum(o.total), 0) from public.orders o
                                      where o.status = 'delivered' and o.delivered_at <@ public.dhaka_range(d::date, d::date)))
             order by d), '[]'::jsonb)
      from generate_series(p_from, p_to, interval '1 day') d)
  ) into v;

  v := v || jsonb_build_object('average_delivered',
    case when (v->>'delivered_count')::int = 0 then 0
         else round((v->>'delivered_revenue')::numeric / (v->>'delivered_count')::int, 2) end);
  return v;
end;
$$;

create or replace function public.report_products(p_from date, p_to date)
returns table (product_id uuid, product_name text, units bigint, revenue numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_permission('revenue');
  return query
    select oi.product_id, max(oi.product_name), sum(oi.quantity)::bigint, sum(oi.line_total)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.status = 'delivered' and o.delivered_at <@ public.dhaka_range(p_from, p_to)
     group by oi.product_id
     order by 4 desc, 3 desc;
end;
$$;

create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_threshold int;
begin
  perform public.require_permission('dashboard');
  select low_stock_threshold into v_threshold from public.store_settings where id = 1;
  v_threshold := coalesce(v_threshold, 3);

  return jsonb_build_object(
    'today', v_today,
    'today_orders', (select count(*) from public.orders where created_at <@ public.dhaka_range(v_today, v_today)),
    'week_orders',  (select count(*) from public.orders where created_at <@ public.dhaka_range(v_today - 6, v_today)),
    -- Money only for roles with the revenue permission.
    'today_delivered_revenue', case when public.has_permission('revenue') then (select coalesce(sum(total), 0) from public.orders
                                where status = 'delivered' and delivered_at <@ public.dhaka_range(v_today, v_today)) end,
    'week_delivered_revenue',  case when public.has_permission('revenue') then (select coalesce(sum(total), 0) from public.orders
                                where status = 'delivered' and delivered_at <@ public.dhaka_range(v_today - 6, v_today)) end,
    'pending_count', (select count(*) from public.orders where status = 'pending'),
    'open_count',    (select count(*) from public.orders where status in ('pending', 'confirmed', 'processing')),
    'shipped_count', (select count(*) from public.orders where status = 'shipped'),
    'low_stock_threshold', v_threshold,
    'low_stock', (
      select coalesce(jsonb_agg(x order by (x->>'stock')::int, x->>'product_name'), '[]'::jsonb)
      from (
        select jsonb_build_object('variant_id', v.id, 'product_id', p.id, 'product_name', p.name,
                                  'sku', v.sku, 'variant_label', public.variant_label(v.color, v.size, v.option3),
                                  'stock', v.stock) as x
          from public.product_variants v
          join public.products p on p.id = v.product_id
         where v.is_active and p.status <> 'archived' and v.stock <= v_threshold
         order by v.stock, p.name
         limit 20
      ) s)
  );
end;
$$;

-- Optional privacy job: blank name, address, area and note on finished
-- orders older than p_days (minimum 30). Phone and totals are kept for
-- reports and duplicate checks. Server-only.
create or replace function public.redact_old_orders(p_days int)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_days is null or p_days < 30 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'days', 'reason', 'Keep at least 30 days')::text;
  end if;
  update public.orders
     set customer_name = 'Redacted', address = 'Redacted', area = null, note = null, redacted_at = now()
   where redacted_at is null
     and status in ('delivered', 'cancelled', 'returned')
     and updated_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.dhaka_range(date, date)      from public, anon, authenticated;
revoke execute on function public.report_summary(date, date)   from public, anon, authenticated;
revoke execute on function public.report_products(date, date)  from public, anon, authenticated;
revoke execute on function public.dashboard_stats()            from public, anon, authenticated;
revoke execute on function public.redact_old_orders(int)       from public, anon, authenticated;

grant execute on function public.dhaka_range(date, date)     to authenticated;
grant execute on function public.report_summary(date, date)  to authenticated;
grant execute on function public.report_products(date, date) to authenticated;
grant execute on function public.dashboard_stats()           to authenticated;
grant execute on function public.redact_old_orders(int)      to service_role;
