-- Stock-in orders (purchase orders): what the shop buys from a supplier.
-- Made as a draft (items, quantities, unit cost); "Receive" adds every line to
-- stock in one go, logs each as a Restock movement linked to the order, and can
-- save the unit costs as the products' cost prices. Safe to run again.

create sequence if not exists public.stock_order_seq;

create table if not exists public.stock_orders (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique default ('SI-' || lpad(nextval('public.stock_order_seq')::text, 4, '0')),
  supplier      text check (char_length(supplier) <= 120),
  supplier_phone text check (char_length(supplier_phone) <= 30),
  note          text check (char_length(note) <= 1000),
  expected_on   date,
  status        text not null default 'draft' check (status in ('draft', 'received', 'cancelled')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  received_at   timestamptz,
  received_by   uuid references auth.users (id) on delete set null
);
drop trigger if exists stock_orders_updated_at on public.stock_orders;
create trigger stock_orders_updated_at before update on public.stock_orders
  for each row execute function public.set_updated_at();

create table if not exists public.stock_order_items (
  id             uuid primary key default gen_random_uuid(),
  stock_order_id uuid not null references public.stock_orders (id) on delete cascade,
  variant_id     uuid not null references public.product_variants (id) on delete restrict,
  quantity       int not null check (quantity between 1 and 100000),
  unit_cost      numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  unique (stock_order_id, variant_id)
);
create index if not exists stock_order_items_order_idx on public.stock_order_items (stock_order_id);

-- Restock movements point at their stock-in order.
alter table public.inventory_movements add column if not exists stock_order_id uuid references public.stock_orders (id) on delete set null;

alter table public.stock_orders enable row level security;
alter table public.stock_order_items enable row level security;

-- Inventory staff read all and edit drafts; receiving goes through receive_stock_order() only.
drop policy if exists stock_orders_read on public.stock_orders;
create policy stock_orders_read on public.stock_orders for select to authenticated using ((select public.has_permission('inventory')));
drop policy if exists stock_orders_insert on public.stock_orders;
create policy stock_orders_insert on public.stock_orders for insert to authenticated
  with check ((select public.has_permission('inventory')) and status = 'draft');
drop policy if exists stock_orders_update on public.stock_orders;
create policy stock_orders_update on public.stock_orders for update to authenticated
  using ((select public.has_permission('inventory')) and status = 'draft')
  with check ((select public.has_permission('inventory')) and status in ('draft', 'cancelled'));
drop policy if exists stock_orders_delete on public.stock_orders;
create policy stock_orders_delete on public.stock_orders for delete to authenticated
  using ((select public.has_permission('inventory')) and status in ('draft', 'cancelled'));

drop policy if exists stock_order_items_read on public.stock_order_items;
create policy stock_order_items_read on public.stock_order_items for select to authenticated using ((select public.has_permission('inventory')));
drop policy if exists stock_order_items_write on public.stock_order_items;
create policy stock_order_items_write on public.stock_order_items for all to authenticated
  using ((select public.has_permission('inventory')) and exists (select 1 from public.stock_orders o where o.id = stock_order_id and o.status = 'draft'))
  with check ((select public.has_permission('inventory')) and exists (select 1 from public.stock_orders o where o.id = stock_order_id and o.status = 'draft'));

grant select, insert, update, delete on public.stock_orders to authenticated;
grant select, insert, update, delete on public.stock_order_items to authenticated;
grant usage on sequence public.stock_order_seq to authenticated;

-- Receive a draft: every line goes into stock (one transaction), logged as Restock.
-- p_save_costs: also save each line's unit cost as that variation's cost price
-- (only for staff who may change prices).
create or replace function public.receive_stock_order(p_order_id uuid, p_save_costs boolean default false)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.stock_orders%rowtype;
  v_item record;
  v_units int := 0;
begin
  perform public.require_permission('inventory');
  select * into v_order from public.stock_orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_order.status <> 'draft' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'status', 'reason', 'This stock-in order was already ' || v_order.status)::text;
  end if;
  if not exists (select 1 from public.stock_order_items where stock_order_id = p_order_id) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'Add at least one product')::text;
  end if;

  for v_item in
    select i.variant_id, i.quantity, i.unit_cost from public.stock_order_items i where i.stock_order_id = p_order_id order by i.variant_id
  loop
    update public.product_variants set stock = stock + v_item.quantity where id = v_item.variant_id;
    insert into public.inventory_movements (variant_id, change, reason, note, created_by, stock_order_id)
    values (v_item.variant_id, v_item.quantity, 'restock', 'Stock-in ' || v_order.ref || coalesce(' · ' || v_order.supplier, ''), auth.uid(), p_order_id);
    if p_save_costs and v_item.unit_cost is not null and public.has_permission('catalog') then
      insert into public.variant_costs (variant_id, cost) values (v_item.variant_id, v_item.unit_cost)
      on conflict (variant_id) do update set cost = excluded.cost, updated_at = now();
    end if;
    v_units := v_units + v_item.quantity;
  end loop;

  update public.stock_orders set status = 'received', received_at = now(), received_by = auth.uid() where id = p_order_id;
  return v_units;
end;
$$;
revoke execute on function public.receive_stock_order(uuid, boolean) from public, anon;
grant execute on function public.receive_stock_order(uuid, boolean) to authenticated;
