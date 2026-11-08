-- Orders sold before the stock arrived (stock went below zero, "sale ongoing")
-- now take their units from the purchase-order batch that brought the stock in,
-- so a batch's "left" matches the real stock and a later return goes back to
-- that batch. Runs by itself whenever a PO line is confirmed, and once now for
-- the batches that already exist. Safe to run again.

-- Give a variation's batches the units of orders that are still out but were
-- never taken from a batch: newest order first, only as many as the batches
-- hold beyond the real stock.
create or replace function public.allocate_backorders(p_variant_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gap int;
  v_order record;
  v_lot record;
  v_left int;
  v_take int;
  v_done int := 0;
begin
  select coalesce(sum(l.remaining), 0) - greatest((select v.stock from public.product_variants v where v.id = p_variant_id), 0)
    into v_gap
    from public.stock_lots l where l.variant_id = p_variant_id;
  if coalesce(v_gap, 0) <= 0 then
    return 0;
  end if;

  for v_order in
    select m.order_id, (-sum(m.change))::int - coalesce((select -sum(lm.qty) from public.lot_movements lm where lm.order_id = m.order_id and lm.variant_id = p_variant_id), 0)::int as owed,
           max(m.created_at) as last_at
      from public.inventory_movements m
     where m.variant_id = p_variant_id and m.order_id is not null
     group by m.order_id
    having (-sum(m.change)) - coalesce((select -sum(lm.qty) from public.lot_movements lm where lm.order_id = m.order_id and lm.variant_id = p_variant_id), 0) > 0
     order by last_at desc
  loop
    exit when v_gap <= 0;
    v_left := least(v_order.owed, v_gap);
    for v_lot in
      select l.id, l.remaining from public.stock_lots l
       where l.variant_id = p_variant_id and l.remaining > 0
       order by l.created_at, l.lot_no
       for update
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.remaining);
      update public.stock_lots set remaining = remaining - v_take where id = v_lot.id;
      insert into public.lot_movements (movement_id, lot_id, order_id, variant_id, qty) values (null, v_lot.id, v_order.order_id, p_variant_id, -v_take);
      v_left := v_left - v_take;
      v_gap := v_gap - v_take;
      v_done := v_done + v_take;
    end loop;
  end loop;
  return v_done;
end;
$$;
revoke execute on function public.allocate_backorders(uuid) from public, anon, authenticated;

-- Batches: as before, plus backorders right after a new batch is made.
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
      -- Orders already sold without stock now come out of this batch.
      perform public.allocate_backorders(new.variant_id);
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

-- Once now, for the batches that already exist.
select public.allocate_backorders(v.variant_id) from (select distinct variant_id from public.stock_lots) v;
