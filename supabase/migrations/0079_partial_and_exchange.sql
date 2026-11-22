-- 0079 — Partial deliveries and exchanges are counted the way they happened.
--
-- * Each order remembers when the courier called it a partial delivery or an
--   exchange (orders.courier_outcome), even after later "return" messages for
--   the unsold part or the old product coming back.
-- * An exchange is a delivered order (Pathao "Exchange"): income is only what
--   the courier collected, and its product cost is not counted again, because
--   the product replaces one already sold and counted with an earlier order.
-- * A partial delivery counts as product cost only the pieces the collected
--   cash paid for (most expensive first), not every piece in the parcel.
-- * Fixes the orders already affected: SD0067 (exchange, wrongly Returned),
--   SD0122 (exchange, still In courier) and SD0128 (partial: 1 of 2 slippers).
-- Safe to run again.

-- 1. Where the courier's word is kept.
alter table public.orders add column if not exists courier_outcome text;
do $$ begin
  alter table public.orders add constraint orders_courier_outcome_chk check (courier_outcome in ('partial', 'exchange'));
exception when duplicate_object then null; end $$;

-- 2. Courier status → order status: an exchange is a delivery.
create or replace function public.courier_status_to_order(p_raw text)
returns public.order_status
language sql
immutable
set search_path = ''
as $$
  select case
    when s in ('delivered', 'partial_delivered', 'partial_delivery', 'delivered_approval_pending',
               'partial_delivered_approval_pending', 'exchange', 'exchanged') then 'delivered'::public.order_status
    when s in ('pickup_cancel', 'pickup_cancelled') then 'cancelled'::public.order_status
    when s in ('cancelled', 'cancelled_approval_pending', 'return', 'returned', 'paid_return', 'return_to_merchant',
               'returned_to_merchant') then 'returned'::public.order_status
    else null
  end
  from (select regexp_replace(regexp_replace(lower(btrim(coalesce(p_raw, ''))), '[^a-z]+', '_', 'g'), '^order_|_$', '', 'g') as s) x;
$$;

-- 3. The courier sync (as in 0078) also records partial / exchange, and then
--    sets Paid to the cash the courier collected (not the whole order).
create or replace function public.apply_courier_status(p_courier text, p_consignment_id text, p_raw_status text,
                                                       p_charge numeric default null, p_collected numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_to public.order_status := public.courier_status_to_order(p_raw_status);
  v_raw text := lower(coalesce(p_raw_status, ''));
  v_paid_return boolean := v_raw ~ 'paid[^a-z]*return';
  v_outcome text := case when v_raw ~ 'exchange' then 'exchange' when v_raw ~ 'partial' then 'partial' end;
  v_status public.order_status;
begin
  select * into o from public.orders
   where courier = p_courier and courier_consignment_id = p_consignment_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  update public.orders set courier_status = left(p_raw_status, 60), courier_synced_at = now(),
         courier_charge = coalesce(p_charge, courier_charge),
         courier_outcome = coalesce(v_outcome, courier_outcome),
         paid_amount = case when v_paid_return and p_collected is not null and p_collected >= 0
                             and o.status <> 'delivered'
                            then least(p_collected, total) else paid_amount end
   where id = o.id;
  v_status := o.status;
  -- Delivered, then "returned": the unsold part of a partial delivery, or the old product of an exchange, coming back.
  if not (o.status = 'delivered' and v_to = 'returned')
     and v_to is not null and v_to <> o.status and o.deleted_at is null
     and (v_to = any (public.allowed_next_statuses(o.status)) or (o.status = 'shipped' and v_to = 'cancelled')) then
    perform public.apply_order_status(o.id, v_to, initcap(p_courier) || ': ' || left(p_raw_status, 60), null);
    v_status := v_to;
  end if;
  -- Partial or exchange: Paid is what the courier collected (plus any advance), never the whole order.
  if v_outcome is not null and p_collected is not null and p_collected >= 0 and v_status = 'delivered' then
    update public.orders set paid_amount = least(total, p_collected + coalesce(paid_before_delivery, 0)) where id = o.id;
  end if;
  return jsonb_build_object('found', true, 'status', v_status);
end;
$$;
revoke execute on function public.apply_courier_status(text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.apply_courier_status(text, text, text, numeric, numeric) to service_role;

-- 4. The pieces of an order that reached the customer (src/lib/delivered-items.ts is the same rule).
create or replace function public.delivered_items(p_order uuid)
returns table (quantity int, unit_cost numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
  o record;
  it record;
  v_left numeric;
  n int;
begin
  select x.courier_outcome, x.total, x.paid_amount, x.delivery_charge, x.discount into o from public.orders x where x.id = p_order;
  if not found or o.courier_outcome = 'exchange' then
    return;
  end if;
  if o.courier_outcome is distinct from 'partial' then
    return query select oi.quantity, oi.unit_cost from public.order_items oi where oi.order_id = p_order;
    return;
  end if;
  -- One taka of slack for rounding.
  v_left := least(o.paid_amount, o.total) - coalesce(o.delivery_charge, 0) + coalesce(o.discount, 0) + 1;
  for it in select oi.quantity as q, oi.unit_price as price, oi.unit_cost as cost from public.order_items oi
             where oi.order_id = p_order order by oi.unit_price desc, oi.created_at, oi.id loop
    n := case when it.price > 0 then greatest(0, least(it.q, floor(v_left / it.price)::int)) else it.q end;
    if n > 0 then
      quantity := n;
      unit_cost := it.cost;
      return next;
      v_left := v_left - n * it.price;
    end if;
  end loop;
end;
$$;
revoke execute on function public.delivered_items(uuid) from public, anon;
grant execute on function public.delivered_items(uuid) to authenticated;

-- 5. Profit & loss (as in 0070): partial deliveries and exchanges count what was
--    collected as income (not as "short at the door") and only delivered pieces as product cost.
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

  with o0 as (
    select o.*, least(o.paid_amount, o.total) as got
      from public.orders o
     where o.status = 'delivered' and o.deleted_at is null and o.delivered_at <@ r
  ), d as (
    select o.id, (o.delivered_at at time zone 'Asia/Dhaka')::date as day,
           case o.courier_outcome when 'exchange' then 0
                                  when 'partial' then greatest(o.got - o.delivery_charge + o.discount, 0)
                                  else o.subtotal end as subtotal,
           case when o.courier_outcome = 'exchange' then 0 else o.discount end as discount,
           case when o.courier_outcome = 'exchange' then o.got else o.delivery_charge end as delivery_charge,
           case when o.courier_outcome in ('partial', 'exchange') then o.got else o.total end as total,
           case when o.courier_outcome in ('partial', 'exchange') then 0 else greatest(o.total - o.paid_amount, 0) end as short,
           (o.courier is not null and o.courier_consignment_id is not null) as by_courier,
           o.courier_charge as charge,
           case when o.courier is not null and o.courier_consignment_id is not null then
             coalesce(o.courier_cod_fee,
                      round(greatest(o.got - coalesce(o.paid_before_delivery, 0), 0)
                            * public.courier_cod_rate_at(o.courier, o.courier_sent_at) / 100, 2))
           else 0 end as cod_fee
      from o0 o
  ), items as (
    select d.day, di.quantity, di.unit_cost
      from d cross join lateral public.delivered_items(d.id) di
  ), e as (
    select x.spent_on as day, x.category, x.amount
      from public.expenses x
     where x.spent_on between p_from and p_to
  ), ret as (
    select (o.returned_at at time zone 'Asia/Dhaka')::date as day, o.total, coalesce(o.courier_charge, o.delivery_charge) as cost,
           o.paid_amount as paid,
           case when o.courier is not null and o.courier_consignment_id is not null and o.paid_amount > 0 then
             coalesce(o.courier_cod_fee, round(o.paid_amount * public.courier_cod_rate_at(o.courier, o.courier_sent_at) / 100, 2))
           else 0 end as cod_fee
      from public.orders o
     where o.status = 'returned' and o.deleted_at is null and o.returned_at <@ r
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'group', g,
    'orders',           (select count(*) from d),
    'product_sales',    (select coalesce(sum(subtotal), 0) from d),
    'discounts',        (select coalesce(sum(discount), 0) from d),
    'delivery_income',  (select coalesce(sum(delivery_charge), 0) from d),
    'short_at_door',    (select coalesce(sum(short), 0) from d),
    'short_orders',     (select count(*) from d where short > 0),
    'return_income',    (select coalesce(sum(paid), 0) from ret),
    'paid_returns',     (select count(*) from ret where paid > 0),
    'income',           (select coalesce(sum(total - short), 0) from d) + (select coalesce(sum(paid), 0) from ret),
    'units',            (select coalesce(sum(quantity), 0) from items),
    'cogs',             (select coalesce(sum(quantity * unit_cost), 0) from items where unit_cost is not null),
    'units_missing_cost', (select coalesce(sum(quantity), 0) from items where unit_cost is null),
    'expenses',         (select coalesce(jsonb_object_agg(category, amt), '{}'::jsonb) from (select category, sum(amount) as amt from e group by category) s),
    'return_delivery',  (select coalesce(sum(cost), 0) from ret),
    'courier_delivery', (select coalesce(sum(charge), 0) from d where by_courier),
    'courier_orders',   (select count(*) from d where by_courier),
    'courier_missing',  (select count(*) from d where by_courier and charge is null),
    'cod_fees',         (select coalesce(sum(cod_fee), 0) from d) + (select coalesce(sum(cod_fee), 0) from ret),
    'expenses_total',   (select coalesce(sum(amount), 0) from e) + (select coalesce(sum(cost), 0) from ret)
                        + (select coalesce(sum(charge), 0) from d where by_courier)
                        + (select coalesce(sum(cod_fee), 0) from d) + (select coalesce(sum(cod_fee), 0) from ret),
    'returned_orders',  (select count(*) from ret),
    'returned_value',   (select coalesce(sum(total), 0) from ret),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.k,
               'orders', coalesce(i.n, 0),
               'returns', coalesce(y.n, 0),
               'income', coalesce(i.inc, 0) + coalesce(y.paid, 0),
               'cogs', coalesce(c.cogs, 0),
               'expenses', coalesce(x.amt, 0) + coalesce(y.amt, 0) + coalesce(i.courier, 0)) order by b.k), '[]'::jsonb)
        from (select distinct public.accounting_bucket(gs::date, g) as k from generate_series(p_from, p_to, interval '1 day') gs) b
        left join (select public.accounting_bucket(day, g) as k, sum(total - short) as inc, count(*) as n,
                          sum(case when by_courier then coalesce(charge, 0) else 0 end) + sum(cod_fee) as courier from d group by 1) i on i.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(quantity * unit_cost) as cogs from items where unit_cost is not null group by 1) c on c.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(amount) as amt from e group by 1) x on x.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(cost) + sum(cod_fee) as amt, sum(paid) as paid, count(*) as n from ret group by 1) y on y.k = b.k
    )
  ) into v;
  return v;
end;
$$;
revoke execute on function public.accounting_pnl(date, date, text) from public, anon;
grant execute on function public.accounting_pnl(date, date, text) to authenticated;

-- 6. Orders already affected, from the courier's own messages.
update public.orders o
   set courier_outcome = x.outcome
  from (
    select e.courier, e.consignment_id,
           case when bool_or(e.event ~* 'exchange' or e.payload->>'return_type' ~* 'exchange') then 'exchange' else 'partial' end as outcome
      from public.courier_events e
     where e.event ~* 'exchange|partial' or e.payload->>'return_type' ~* 'exchange|partial'
     group by 1, 2
  ) x
 where o.courier = x.courier and o.courier_consignment_id = x.consignment_id and o.courier_outcome is null;

-- An exchange the sync later turned into Returned (SD0067): it was delivered.
with fixed as (
  update public.orders o
     set status = 'delivered', returned_at = null,
         delivered_at = coalesce(o.delivered_at, now()),
         paid_amount = least(o.total, coalesce(o.courier_collected, 0) + coalesce(o.paid_before_delivery, 0))
   where o.courier_outcome = 'exchange' and o.status = 'returned' and o.deleted_at is null
  returning o.id
)
insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
select id, 'returned', 'delivered', null, 'Exchange: delivered (the courier''s return was the old product coming back)' from fixed;

-- An exchange still In courier (SD0122): deliver it the way the courier sync would.
select public.apply_courier_status(o.courier, o.courier_consignment_id, 'exchange', null, o.courier_collected)
  from public.orders o
 where o.courier_outcome = 'exchange' and o.status = 'shipped' and o.deleted_at is null and o.courier_consignment_id is not null;
