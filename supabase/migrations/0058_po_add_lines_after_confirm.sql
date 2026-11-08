-- Purchase orders stay open after Confirm: confirmed lines are locked (their
-- quantity and cost never change), new lines can be added and wait as Pending;
-- confirming again adds only the pending lines to stock. Safe to run again.

-- Each line knows when it went into stock (null = pending).
alter table public.stock_order_items add column if not exists received_at timestamptz;
update public.stock_order_items i set received_at = o.received_at
  from public.stock_orders o
 where o.id = i.stock_order_id and o.status = 'received' and i.received_at is null;

-- The same product can be ordered again later on the same PO (a new line).
alter table public.stock_order_items drop constraint if exists stock_order_items_stock_order_id_variant_id_key;
create unique index if not exists stock_order_items_pending_once on public.stock_order_items (stock_order_id, variant_id) where received_at is null;

-- The order's details (supplier, note, date) can be edited while it is a draft or confirmed.
drop policy if exists stock_orders_update on public.stock_orders;
create policy stock_orders_update on public.stock_orders for update to authenticated
  using ((select public.has_permission('inventory')) and status in ('draft', 'received'))
  with check ((select public.has_permission('inventory')) and status in ('draft', 'received', 'cancelled'));

-- Status changes only through Confirm (receive_stock_order), or draft → cancelled.
create or replace function public.stock_orders_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (old.status = 'draft' and new.status = 'cancelled')
     and coalesce(current_setting('app.po_confirming', true), '') <> '1' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'status', 'reason', 'Use Confirm to add stock')::text;
  end if;
  return new;
end;
$$;
drop trigger if exists stock_orders_status_guard on public.stock_orders;
create trigger stock_orders_status_guard before update on public.stock_orders
  for each row execute function public.stock_orders_status_guard();

-- Only pending lines (never confirmed ones) can be added, changed or removed.
drop policy if exists stock_order_items_write on public.stock_order_items;
drop policy if exists stock_order_items_insert on public.stock_order_items;
drop policy if exists stock_order_items_update on public.stock_order_items;
drop policy if exists stock_order_items_delete on public.stock_order_items;
create policy stock_order_items_insert on public.stock_order_items for insert to authenticated
  with check ((select public.has_permission('inventory')) and received_at is null
              and exists (select 1 from public.stock_orders o where o.id = stock_order_id and o.status in ('draft', 'received')));
create policy stock_order_items_update on public.stock_order_items for update to authenticated
  using ((select public.has_permission('inventory')) and received_at is null)
  with check ((select public.has_permission('inventory')) and received_at is null);
create policy stock_order_items_delete on public.stock_order_items for delete to authenticated
  using ((select public.has_permission('inventory')) and received_at is null
         and exists (select 1 from public.stock_orders o where o.id = stock_order_id and o.status in ('draft', 'received', 'cancelled')));

-- A new batch takes the cost of the pending line being confirmed.
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
    if new.change > 0 and new.stock_order_id is not null and new.reason = 'restock' then
      select o.ref into v_ref from public.stock_orders o where o.id = new.stock_order_id;
      select count(*) + 1 into v_n from public.stock_lots l where l.stock_order_id = new.stock_order_id;
      select i.unit_cost into v_cost from public.stock_order_items i
       where i.stock_order_id = new.stock_order_id and i.variant_id = new.variant_id
       order by (i.received_at is null) desc, i.received_at desc limit 1;
      insert into public.stock_lots (lot_no, stock_order_id, variant_id, received, remaining, unit_cost)
      values (coalesce(v_ref, 'PO') || '-' || lpad(v_n::text, 2, '0'), new.stock_order_id, new.variant_id, new.change, new.change, v_cost);
      return new;
    end if;

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

-- Confirm: adds only the pending lines (works again and again on the same PO).
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
  if v_order.status = 'cancelled' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'status', 'reason', 'This purchase order was cancelled')::text;
  end if;
  if not exists (select 1 from public.stock_order_items where stock_order_id = p_order_id and received_at is null and variant_id is not null) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'Nothing pending to confirm')::text;
  end if;

  for v_item in
    select i.id, i.variant_id, i.quantity, i.unit_cost from public.stock_order_items i
     where i.stock_order_id = p_order_id and i.received_at is null and i.variant_id is not null
     order by i.id
  loop
    update public.product_variants set stock = stock + v_item.quantity where id = v_item.variant_id;
    insert into public.inventory_movements (variant_id, change, reason, note, created_by, stock_order_id)
    values (v_item.variant_id, v_item.quantity, 'restock', 'Purchase order ' || v_order.ref || coalesce(' · ' || v_order.supplier, ''), auth.uid(), p_order_id);
    update public.stock_order_items set received_at = now() where id = v_item.id;
    if p_save_costs and v_item.unit_cost is not null and public.has_permission('catalog') then
      insert into public.variant_costs (variant_id, cost) values (v_item.variant_id, v_item.unit_cost)
      on conflict (variant_id) do update set cost = excluded.cost, updated_at = now();
    end if;
    v_units := v_units + v_item.quantity;
  end loop;

  perform set_config('app.po_confirming', '1', true);
  update public.stock_orders set status = 'received', received_at = now(), received_by = auth.uid() where id = p_order_id;
  perform set_config('app.po_confirming', '', true);
  return v_units;
end;
$$;
revoke execute on function public.receive_stock_order(uuid, boolean) from public, anon;
grant execute on function public.receive_stock_order(uuid, boolean) to authenticated;
