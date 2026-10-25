-- 0015 — Everything the admin dashboard shows for a date range, in one call.
--
-- "Sales" are orders placed in the range that are not cancelled, returned,
-- lost or fake (deleted orders never count). Money is null for roles
-- without the revenue permission, as in dashboard_stats(). Runs as the
-- caller, so RLS still decides which orders are visible.

create index if not exists orders_created_at_idx on public.orders (created_at);

create or replace function public.dashboard_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r tstzrange;
  prev tstzrange;
  v_money boolean;
  v jsonb;
begin
  perform public.require_permission('dashboard');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'range', 'reason', 'Choose a range of up to one year')::text;
  end if;
  r := public.dhaka_range(p_from, p_to);
  prev := public.dhaka_range(p_from - (p_to - p_from) - 1, p_from - 1);
  v_money := public.has_permission('revenue');

  with o as (
    select x.*, x.status not in ('cancelled', 'returned', 'lost', 'fake') as counts
      from public.orders x
     where x.created_at <@ r and x.deleted_at is null
  ),
  po as (
    select x.total, x.status not in ('cancelled', 'returned', 'lost', 'fake') as counts
      from public.orders x
     where x.created_at <@ prev and x.deleted_at is null
  ),
  items as (
    select oi.*, o.status, o.counts
      from public.order_items oi
      join o on o.id = oi.order_id
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'money', v_money,
    'total_orders',     (select count(*) from o),
    'prev_total_orders',(select count(*) from po),
    'sales',            case when v_money then (select coalesce(sum(total), 0) from o where counts) end,
    'prev_sales',       case when v_money then (select coalesce(sum(total), 0) from po where counts) end,
    'valid_orders',     (select count(*) from o where counts),
    'active_orders',    (select count(*) from o where status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped')),
    'active_value',     case when v_money then (select coalesce(sum(total), 0) from o where status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped')) end,
    'delivered_orders', (select count(*) from o where status = 'delivered'),
    'delivered_value',  case when v_money then (select coalesce(sum(total), 0) from o where status = 'delivered') end,
    'cancelled_orders', (select count(*) from o where status in ('cancelled', 'fake')),
    'cancelled_value',  case when v_money then (select coalesce(sum(total), 0) from o where status in ('cancelled', 'fake')) end,
    'returned_orders',  (select count(*) from o where status = 'returned'),
    'status_counts',    (select coalesce(jsonb_object_agg(status::text, n), '{}'::jsonb) from (select status, count(*) as n from o group by status) s),
    'breakdown', case when v_money then jsonb_build_object(
        'gross',    (select coalesce(sum(subtotal), 0) from o where counts),
        'discount', (select coalesce(sum(discount), 0) from o where counts),
        'delivery', (select coalesce(sum(delivery_charge), 0) from o where counts),
        'returns',  (select coalesce(sum(total), 0) from o where status = 'returned'),
        'net',      (select coalesce(sum(total), 0) from o where counts)) end,
    'customers', (select count(distinct customer_phone) from o),
    'returning_customers', (
      select count(*) from (
        select o.customer_phone
          from o
         group by o.customer_phone
        having count(*) > 1
            or exists (select 1 from public.orders e
                        where e.customer_phone = o.customer_phone and e.created_at < lower(r) and e.deleted_at is null)
      ) s),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d::date,
               'orders', (select count(*) from o where o.created_at <@ public.dhaka_range(d::date, d::date)),
               'sales', case when v_money then (select coalesce(sum(total), 0) from o where counts and o.created_at <@ public.dhaka_range(d::date, d::date)) end)
             order by d), '[]'::jsonb)
        from generate_series(p_from, p_to, interval '1 day') d),
    'districts', (
      select coalesce(jsonb_agg(jsonb_build_object('district', district, 'orders', n, 'sales', case when v_money then s end) order by n desc, district), '[]'::jsonb)
        from (select initcap(lower(btrim(district))) as district, count(*) as n, sum(total) filter (where counts) as s
                from o group by 1 order by 2 desc, 1 limit 10) t),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'units', units, 'sales', case when v_money then s end) order by s desc nulls last, units desc), '[]'::jsonb)
        from (select coalesce(c.name, 'Uncategorised') as category, sum(i.quantity) as units, sum(i.line_total) as s
                from items i
                left join public.products p on p.id = i.product_id
                left join public.categories c on c.id = p.category_id
               where i.counts
               group by 1 order by 3 desc limit 8) t),
    'top_products', (
      select coalesce(jsonb_agg(t order by (t->>'units')::int desc), '[]'::jsonb)
        from (select jsonb_build_object(
                       'product_id', i.product_id,
                       'name', max(i.product_name),
                       'image', (select pi.storage_path from public.product_images pi where pi.product_id = i.product_id order by pi.sort_order limit 1),
                       'units', sum(i.quantity),
                       'orders', count(distinct i.order_id),
                       'sales', case when v_money then sum(i.line_total) end) as t
                from items i
               where i.counts
               group by i.product_id
               order by sum(i.quantity) desc
               limit 5) s),
    'top_customers', (
      select coalesce(jsonb_agg(t order by (t->>'orders')::int desc), '[]'::jsonb)
        from (select jsonb_build_object(
                       'name', (array_agg(customer_name order by created_at desc))[1],
                       'phone', customer_phone,
                       'orders', count(*),
                       'spent', case when v_money then sum(total) end) as t
                from o
               where counts
               group by customer_phone
               order by count(*) desc, sum(total) desc
               limit 5) s),
    'product_report', (
      select coalesce(jsonb_agg(t order by (t->>'orders')::int desc), '[]'::jsonb)
        from (select jsonb_build_object(
                       'product_id', i.product_id,
                       'sku', (select p.sku from public.products p where p.id = i.product_id),
                       'name', max(i.product_name),
                       'image', (select pi.storage_path from public.product_images pi where pi.product_id = i.product_id order by pi.sort_order limit 1),
                       'orders', count(distinct i.order_id),
                       'value', case when v_money then sum(i.line_total) end,
                       'cancelled', count(distinct i.order_id) filter (where i.status in ('cancelled', 'fake', 'returned')),
                       'cancelled_value', case when v_money then coalesce(sum(i.line_total) filter (where i.status in ('cancelled', 'fake', 'returned')), 0) end,
                       'pending', count(distinct i.order_id) filter (where i.status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped')),
                       'pending_value', case when v_money then coalesce(sum(i.line_total) filter (where i.status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped')), 0) end) as t
                from items i
               group by i.product_id
               order by count(distinct i.order_id) desc
               limit 10) s)
  ) into v;

  return v;
end;
$$;

revoke execute on function public.dashboard_report(date, date) from public, anon;
grant execute on function public.dashboard_report(date, date) to authenticated;
