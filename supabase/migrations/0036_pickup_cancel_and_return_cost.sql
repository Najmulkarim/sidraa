-- 0036 — A pickup the courier cancelled is a cancelled order, not a return (the
-- parcel never left), and the delivery cost of returned orders counts as an
-- expense in Accounting. Safe to run again.

-- 1. Courier status → order status.
create or replace function public.courier_status_to_order(p_raw text)
returns public.order_status
language sql
immutable
set search_path = ''
as $$
  select case
    when s in ('delivered', 'partial_delivered', 'partial_delivery', 'delivered_approval_pending',
               'partial_delivered_approval_pending') then 'delivered'::public.order_status
    when s in ('pickup_cancel', 'pickup_cancelled') then 'cancelled'::public.order_status
    when s in ('cancelled', 'cancelled_approval_pending', 'return', 'returned', 'paid_return', 'return_to_merchant',
               'returned_to_merchant') then 'returned'::public.order_status
    else null
  end
  from (select regexp_replace(regexp_replace(lower(btrim(coalesce(p_raw, ''))), '[^a-z]+', '_', 'g'), '^order_|_$', '', 'g') as s) x;
$$;

-- 2. Only the courier sync (no staff member behind it) may cancel an order that
--    is with the courier. Staff still cannot, so a parcel on the road keeps its stock.
do $$
declare
  v_def text := pg_get_functiondef('public.apply_order_status(uuid, public.order_status, text, uuid)'::regprocedure);
  v_old text := 'not (p_status = any (public.allowed_next_statuses(v_order.status)))';
  v_new text := 'not (p_status = any (public.allowed_next_statuses(v_order.status)) or (p_actor is null and v_order.status = ''shipped'' and p_status = ''cancelled''))';
begin
  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'apply_order_status has changed: transition check not found';
  end if;
end $$;

create or replace function public.apply_courier_status(p_courier text, p_consignment_id text, p_raw_status text, p_charge numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_to public.order_status := public.courier_status_to_order(p_raw_status);
begin
  select * into o from public.orders
   where courier = p_courier and courier_consignment_id = p_consignment_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  update public.orders set courier_status = left(p_raw_status, 60), courier_synced_at = now(),
         courier_charge = coalesce(p_charge, courier_charge)
   where id = o.id;
  if v_to is not null and v_to <> o.status and o.deleted_at is null
     and (v_to = any (public.allowed_next_statuses(o.status)) or (o.status = 'shipped' and v_to = 'cancelled')) then
    perform public.apply_order_status(o.id, v_to, initcap(p_courier) || ': ' || left(p_raw_status, 60), null);
    return jsonb_build_object('found', true, 'status', v_to);
  end if;
  return jsonb_build_object('found', true, 'status', o.status);
end;
$$;

-- 3. Orders already marked returned because of a cancelled pickup (stock is already back).
with fixed as (
  update public.orders o
     set status = 'cancelled', cancelled_at = coalesce(o.returned_at, now()), returned_at = null
   where o.status = 'returned'
     and regexp_replace(lower(btrim(coalesce(o.courier_status, ''))), '[^a-z]+', '_', 'g') in ('pickup_cancel', 'pickup_cancelled')
  returning o.id
)
insert into public.order_status_history (order_id, from_status, to_status, note)
select id, 'returned', 'cancelled', 'Corrected: the courier cancelled the pickup, so the parcel was never returned' from fixed;

-- 4. Accounting: what a returned order cost in delivery is an expense, on the day it came back.
--    The courier's own charge when known, else the delivery charge on the order.
create or replace function public.accounting_pnl(p_from date, p_to date, p_group text default 'day')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r tstzrange;
  g text := case when p_group in ('day', 'week', 'month', 'year') then p_group else 'day' end;
  v jsonb;
begin
  perform public.require_permission('revenue');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3700 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'range', 'reason', 'Choose a period of up to ten years')::text;
  end if;
  if g = 'day' and p_to - p_from > 400 then g := 'month'; end if;
  r := public.dhaka_range(p_from, p_to);

  with d as (
    select o.id, (o.delivered_at at time zone 'Asia/Dhaka')::date as day, o.subtotal, o.discount, o.delivery_charge, o.total
      from public.orders o
     where o.status = 'delivered' and o.deleted_at is null and o.delivered_at <@ r
  ), items as (
    select d.day, oi.quantity, oi.unit_cost
      from d join public.order_items oi on oi.order_id = d.id
  ), e as (
    select x.spent_on as day, x.category, x.amount
      from public.expenses x
     where x.spent_on between p_from and p_to
  ), ret as (
    select (o.returned_at at time zone 'Asia/Dhaka')::date as day, o.total, coalesce(o.courier_charge, o.delivery_charge) as cost
      from public.orders o
     where o.status = 'returned' and o.deleted_at is null and o.returned_at <@ r
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'group', g,
    'orders',           (select count(*) from d),
    'product_sales',    (select coalesce(sum(subtotal), 0) from d),
    'discounts',        (select coalesce(sum(discount), 0) from d),
    'delivery_income',  (select coalesce(sum(delivery_charge), 0) from d),
    'income',           (select coalesce(sum(total), 0) from d),
    'units',            (select coalesce(sum(quantity), 0) from items),
    'cogs',             (select coalesce(sum(quantity * unit_cost), 0) from items where unit_cost is not null),
    'units_missing_cost', (select coalesce(sum(quantity), 0) from items where unit_cost is null),
    'expenses',         (select coalesce(jsonb_object_agg(category, amt), '{}'::jsonb) from (select category, sum(amount) as amt from e group by category) s),
    'return_delivery',  (select coalesce(sum(cost), 0) from ret),
    'expenses_total',   (select coalesce(sum(amount), 0) from e) + (select coalesce(sum(cost), 0) from ret),
    'returned_orders',  (select count(*) from ret),
    'returned_value',   (select coalesce(sum(total), 0) from ret),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.k,
               'orders', coalesce(i.n, 0),
               'income', coalesce(i.inc, 0),
               'cogs', coalesce(c.cogs, 0),
               'expenses', coalesce(x.amt, 0) + coalesce(y.amt, 0)) order by b.k), '[]'::jsonb)
        from (select distinct public.accounting_bucket(gs::date, g) as k from generate_series(p_from, p_to, interval '1 day') gs) b
        left join (select public.accounting_bucket(day, g) as k, sum(total) as inc, count(*) as n from d group by 1) i on i.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(quantity * unit_cost) as cogs from items where unit_cost is not null group by 1) c on c.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(amount) as amt from e group by 1) x on x.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(cost) as amt from ret group by 1) y on y.k = b.k
    )
  ) into v;
  return v;
end;
$$;
revoke execute on function public.accounting_pnl(date, date, text) from public, anon;
grant execute on function public.accounting_pnl(date, date, text) to authenticated;
