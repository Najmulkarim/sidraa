-- 0033 — Accounting: cost prices, expenses, profit & loss. Safe to run again.
--
-- * Cost prices live in their own staff-only tables (products are public, costs are not):
--   product_costs (one per product) and variant_costs (optional, per variation).
-- * order_items.unit_cost: the cost at the time of the sale, filled in automatically
--   when an order line is created; lines from before a cost was entered get it the
--   moment the cost is saved. Changing a cost later never rewrites old sales
--   (reapply_item_costs() does that on request, for a chosen period).
-- * expenses: ad cost, salaries, rent, courier, packaging, … by day.
-- * accounting_pnl(): profit & loss for a period, the Zoho Books layout — income,
--   cost of goods sold, gross profit, expenses by category, net profit — plus a
--   day / week / month / year breakdown. Sales count on the day an order is
--   delivered (cash in hand for cash on delivery); deleted orders never count.
begin;

-- ------------------------------------------------------------ cost prices
create table if not exists public.product_costs (
  product_id  uuid primary key references public.products (id) on delete cascade,
  cost        numeric(12,2) not null check (cost >= 0),
  updated_at  timestamptz not null default now()
);
create table if not exists public.variant_costs (
  variant_id  uuid primary key references public.product_variants (id) on delete cascade,
  cost        numeric(12,2) not null check (cost >= 0),
  updated_at  timestamptz not null default now()
);
alter table public.order_items add column if not exists unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0);

alter table public.product_costs enable row level security;
alter table public.variant_costs enable row level security;
drop policy if exists product_costs_staff on public.product_costs;
create policy product_costs_staff on public.product_costs for all to authenticated
  using (public.has_permission('catalog') or public.has_permission('revenue'))
  with check (public.has_permission('catalog'));
drop policy if exists variant_costs_staff on public.variant_costs;
create policy variant_costs_staff on public.variant_costs for all to authenticated
  using (public.has_permission('catalog') or public.has_permission('revenue'))
  with check (public.has_permission('catalog'));

-- The cost of one unit of a variation: its own cost, else the product's.
create or replace function public.current_unit_cost(p_variant_id uuid, p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select vc.cost from public.variant_costs vc where vc.variant_id = p_variant_id),
    (select pc.cost from public.product_costs pc
      where pc.product_id = coalesce(p_product_id, (select v.product_id from public.product_variants v where v.id = p_variant_id)))
  );
$$;
revoke execute on function public.current_unit_cost(uuid, uuid) from public, anon;

-- New order lines remember today's cost.
create or replace function public.order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_cost is null then
    new.unit_cost := public.current_unit_cost(new.variant_id, new.product_id);
  end if;
  return new;
end;
$$;
drop trigger if exists order_items_cost on public.order_items;
create trigger order_items_cost before insert on public.order_items
  for each row execute function public.order_item_cost();

-- A cost saved for the first time also fills the sales made before it was known.
create or replace function public.fill_missing_item_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_items oi
     set unit_cost = public.current_unit_cost(oi.variant_id, oi.product_id)
   where oi.unit_cost is null
     and public.current_unit_cost(oi.variant_id, oi.product_id) is not null;
  return null;
end;
$$;
drop trigger if exists product_costs_fill on public.product_costs;
create trigger product_costs_fill after insert or update on public.product_costs
  for each statement execute function public.fill_missing_item_costs();
drop trigger if exists variant_costs_fill on public.variant_costs;
create trigger variant_costs_fill after insert or update on public.variant_costs
  for each statement execute function public.fill_missing_item_costs();

-- On request: give the sales in a period today's cost prices (e.g. after fixing a wrong cost).
create or replace function public.reapply_item_costs(p_from date, p_to date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform public.require_permission('revenue');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'range', 'reason', 'Choose a valid period')::text;
  end if;
  update public.order_items oi
     set unit_cost = c.cost
    from (
      select i.id, public.current_unit_cost(i.variant_id, i.product_id) as cost
        from public.order_items i
        join public.orders o on o.id = i.order_id
       where o.deleted_at is null and o.status = 'delivered'
         and o.delivered_at <@ public.dhaka_range(p_from, p_to)
    ) c
   where c.id = oi.id and c.cost is not null and oi.unit_cost is distinct from c.cost;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.reapply_item_costs(date, date) from public, anon;
grant execute on function public.reapply_item_costs(date, date) to authenticated;

-- --------------------------------------------------------------- expenses
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null,
  category    text not null check (category in ('advertising', 'salary', 'rent', 'utilities', 'courier', 'packaging', 'transport', 'software', 'other')),
  amount      numeric(12,2) not null check (amount > 0 and amount < 100000000),
  paid_via    text not null default 'cash' check (paid_via in ('cash', 'bkash', 'nagad', 'bank', 'card', 'other')),
  reference   text check (char_length(reference) <= 80),
  note        text check (char_length(note) <= 300),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);
alter table public.expenses enable row level security;
drop policy if exists expenses_staff on public.expenses;
create policy expenses_staff on public.expenses for all to authenticated
  using (public.has_permission('revenue'))
  with check (public.has_permission('revenue'));

-- ---------------------------------------------------------- profit & loss
-- Start of the period a day falls in. Weeks start on Saturday (the Bangladesh week).
create or replace function public.accounting_bucket(d date, g text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case g
           when 'week'  then d - ((extract(dow from d)::int + 1) % 7)
           when 'month' then date_trunc('month', d)::date
           when 'year'  then date_trunc('year', d)::date
           else d
         end;
$$;

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
    'expenses_total',   (select coalesce(sum(amount), 0) from e),
    'returned_orders',  (select count(*) from public.orders o where o.status = 'returned' and o.deleted_at is null and o.returned_at <@ r),
    'returned_value',   (select coalesce(sum(o.total), 0) from public.orders o where o.status = 'returned' and o.deleted_at is null and o.returned_at <@ r),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', b.k,
               'orders', coalesce(i.n, 0),
               'income', coalesce(i.inc, 0),
               'cogs', coalesce(c.cogs, 0),
               'expenses', coalesce(x.amt, 0)) order by b.k), '[]'::jsonb)
        from (select distinct public.accounting_bucket(gs::date, g) as k from generate_series(p_from, p_to, interval '1 day') gs) b
        left join (select public.accounting_bucket(day, g) as k, sum(total) as inc, count(*) as n from d group by 1) i on i.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(quantity * unit_cost) as cogs from items where unit_cost is not null group by 1) c on c.k = b.k
        left join (select public.accounting_bucket(day, g) as k, sum(amount) as amt from e group by 1) x on x.k = b.k
    )
  ) into v;
  return v;
end;
$$;
revoke execute on function public.accounting_pnl(date, date, text) from public, anon;
grant execute on function public.accounting_pnl(date, date, text) to authenticated;

commit;
