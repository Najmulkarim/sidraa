-- Batches (lots): every confirmed purchase-order line becomes a lot with its own
-- serial number (PO-0001-01, PO-0001-02, …). Sales take stock from the oldest
-- lot first; a cancel or return puts the units back into the same lot(s) the
-- order took them from. Kept by a trigger on inventory_movements, so every
-- stock change (orders, edits, deletes, adjustments) is followed without
-- touching the order functions. Tracking never blocks a sale: if it fails,
-- the sale goes through and the units simply stay outside any lot.
-- Safe to run again.

create table if not exists public.stock_lots (
  id             uuid primary key default gen_random_uuid(),
  lot_no         text not null unique,
  stock_order_id uuid references public.stock_orders (id) on delete set null,
  variant_id     uuid not null references public.product_variants (id) on delete cascade,
  received       int not null check (received > 0),
  remaining      int not null check (remaining >= 0),
  unit_cost      numeric(12,2),
  created_at     timestamptz not null default now()
);
create index if not exists stock_lots_variant_idx on public.stock_lots (variant_id, created_at) where remaining > 0;
create index if not exists stock_lots_order_idx on public.stock_lots (stock_order_id);

-- Each unit taken from or put back into a lot (qty < 0 out, > 0 back).
create table if not exists public.lot_movements (
  id          bigint generated always as identity primary key,
  movement_id bigint references public.inventory_movements (id) on delete cascade,
  lot_id      uuid not null references public.stock_lots (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  variant_id  uuid not null,
  qty         int not null check (qty <> 0),
  created_at  timestamptz not null default now()
);
create index if not exists lot_movements_lot_idx on public.lot_movements (lot_id);
create index if not exists lot_movements_order_idx on public.lot_movements (order_id, variant_id);
create index if not exists lot_movements_movement_idx on public.lot_movements (movement_id);

alter table public.stock_lots enable row level security;
alter table public.lot_movements enable row level security;
drop policy if exists stock_lots_read on public.stock_lots;
create policy stock_lots_read on public.stock_lots for select to authenticated using ((select public.has_permission('inventory')) or (select public.has_permission('orders')));
drop policy if exists lot_movements_read on public.lot_movements;
create policy lot_movements_read on public.lot_movements for select to authenticated using ((select public.has_permission('inventory')) or (select public.has_permission('orders')));
grant select on public.stock_lots, public.lot_movements to authenticated;

create or replace function public.track_stock_lots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left int;
  v_take int;
  v_lot record;
  v_ref text;
  v_n int;
  v_cost numeric;
begin
  begin
    -- A purchase-order line confirmed: a new lot.
    if new.change > 0 and new.stock_order_id is not null and new.reason = 'restock' then
      select o.ref into v_ref from public.stock_orders o where o.id = new.stock_order_id;
      select count(*) + 1 into v_n from public.stock_lots l where l.stock_order_id = new.stock_order_id;
      select i.unit_cost into v_cost from public.stock_order_items i where i.stock_order_id = new.stock_order_id and i.variant_id = new.variant_id limit 1;
      insert into public.stock_lots (lot_no, stock_order_id, variant_id, received, remaining, unit_cost)
      values (coalesce(v_ref, 'PO') || '-' || lpad(v_n::text, 2, '0'), new.stock_order_id, new.variant_id, new.change, new.change, v_cost);
      return new;
    end if;

    -- Units out (a sale, an order edit up, a manual count down): oldest lot first.
    if new.change < 0 then
      v_left := -new.change;
      for v_lot in
        select l.id, l.remaining from public.stock_lots l
         where l.variant_id = new.variant_id and l.remaining > 0
         order by l.created_at, l.lot_no
         for update
      loop
        exit when v_left <= 0;
        v_take := least(v_left, v_lot.remaining);
        update public.stock_lots set remaining = remaining - v_take where id = v_lot.id;
        insert into public.lot_movements (movement_id, lot_id, order_id, variant_id, qty) values (new.id, v_lot.id, new.order_id, new.variant_id, -v_take);
        v_left := v_left - v_take;
      end loop;
      return new;
    end if;

    -- Units back from an order (cancel, return, edit down, delete): into the lots it took them from.
    if new.change > 0 and new.order_id is not null then
      v_left := new.change;
      for v_lot in
        select lm.lot_id, -sum(lm.qty)::int as held, max(l.created_at) as made
          from public.lot_movements lm join public.stock_lots l on l.id = lm.lot_id
         where lm.order_id = new.order_id and lm.variant_id = new.variant_id
         group by lm.lot_id
        having -sum(lm.qty) > 0
         order by made desc
      loop
        exit when v_left <= 0;
        v_take := least(v_left, v_lot.held);
        update public.stock_lots set remaining = remaining + v_take where id = v_lot.lot_id;
        insert into public.lot_movements (movement_id, lot_id, order_id, variant_id, qty) values (new.id, v_lot.lot_id, new.order_id, new.variant_id, v_take);
        v_left := v_left - v_take;
      end loop;
    end if;
  exception when others then
    raise warning 'stock lot tracking skipped for movement %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.track_stock_lots() from public, anon, authenticated;

drop trigger if exists inventory_movements_lots on public.inventory_movements;
create trigger inventory_movements_lots after insert on public.inventory_movements
  for each row execute function public.track_stock_lots();
