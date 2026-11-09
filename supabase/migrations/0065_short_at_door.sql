-- 0065 — Accounting counts what was really taken for a delivered order: when
-- the customer paid less at the door (staff lower Paid on the order), the
-- shortfall is taken off income as its own line. Safe to run again.
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
    select o.id, (o.delivered_at at time zone 'Asia/Dhaka')::date as day, o.subtotal, o.discount, o.delivery_charge, o.total,
           greatest(o.total - o.paid_amount, 0) as short
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
    select (o.returned_at at time zone 'Asia/Dhaka')::date as day, o.total, coalesce(o.courier_charge, o.delivery_charge) as cost,
           o.paid_amount as paid
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
    'expenses_total',   (select coalesce(sum(amount), 0) from e) + (select coalesce(sum(cost), 0) from ret),
    'returned_orders',  (select count(*) from ret),
    'returned_value',   (select coalesce(sum(total), 0) from ret),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.k,
               'orders', coalesce(i.n, 0),
               'income', coalesce(i.inc, 0) + coalesce(y.paid, 0),
               'cogs', coalesce(c.cogs, 0),
               'expenses', coalesce(x.amt, 0) + coalesce(y.amt, 0)) order by b.k), '[]'::jsonb)
        from (select distinct public.accounting_bucket(gs::date, g) as k from generate_series(p_from, p_to, interval '1 day') gs) b
        left join (select public.accounting_bucket(day, g) as k, sum(total - short) as inc, count(*) as n from d group by 1) i on i.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(quantity * unit_cost) as cogs from items where unit_cost is not null group by 1) c on c.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(amount) as amt from e group by 1) x on x.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(cost) as amt, sum(paid) as paid from ret group by 1) y on y.k = b.k
    )
  ) into v;
  return v;
end;
$$;
revoke execute on function public.accounting_pnl(date, date, text) from public, anon;
grant execute on function public.accounting_pnl(date, date, text) to authenticated;
