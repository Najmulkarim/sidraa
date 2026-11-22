-- 0080 — The unsold part of a partial delivery goes back into stock when it
-- reaches the shop (the courier says "returned to merchant").
-- Only the pieces the collected cash did not pay for (same rule as
-- delivered_items, 0079) come back, once, as a 'return' stock movement, so
-- batches (lots) are put back the usual way.
-- Exchanges are not restocked automatically: what comes back is the
-- customer's old product, which the order does not name. Add it in Inventory.
-- Safe to run again.

alter table public.orders add column if not exists leftover_restocked boolean not null default false;

-- delivered_items now also says which order line and variant each delivered piece is from.
drop function if exists public.delivered_items(uuid);
create function public.delivered_items(p_order uuid)
returns table (order_item_id uuid, variant_id uuid, quantity int, unit_cost numeric)
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
    return query select oi.id, oi.variant_id, oi.quantity, oi.unit_cost from public.order_items oi where oi.order_id = p_order;
    return;
  end if;
  -- One taka of slack for rounding.
  v_left := least(o.paid_amount, o.total) - coalesce(o.delivery_charge, 0) + coalesce(o.discount, 0) + 1;
  for it in select oi.id as item, oi.variant_id as variant, oi.quantity as q, oi.unit_price as price, oi.unit_cost as cost
              from public.order_items oi
             where oi.order_id = p_order order by oi.unit_price desc, oi.created_at, oi.id loop
    n := case when it.price > 0 then greatest(0, least(it.q, floor(v_left / it.price)::int)) else it.q end;
    if n > 0 then
      order_item_id := it.item;
      variant_id := it.variant;
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

-- Puts the undelivered pieces of a partial delivery back into stock (once).
create or replace function public.restock_partial_leftover(p_order uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_pieces int;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.courier_outcome is distinct from 'partial' or o.status <> 'delivered' or o.leftover_restocked then
    return 0;
  end if;

  perform 1 from public.product_variants v
   where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order) order by v.id for update;

  with l as (
    select oi.variant_id, sum(oi.quantity - coalesce(d.quantity, 0))::int as qty
      from public.order_items oi
      left join public.delivered_items(p_order) d on d.order_item_id = oi.id
     where oi.order_id = p_order and oi.variant_id is not null
     group by oi.variant_id
    having sum(oi.quantity - coalesce(d.quantity, 0)) > 0
  ), up as (
    update public.product_variants v set stock = v.stock + l.qty from l where v.id = l.variant_id returning l.qty
  ), mv as (
    insert into public.inventory_movements (variant_id, change, reason, order_id, created_by, note)
    select l.variant_id, l.qty, 'return', p_order, null, 'Partial delivery: the unsold part came back' from l
  )
  select coalesce(sum(qty), 0) into v_pieces from up;

  update public.orders set leftover_restocked = true where id = p_order;
  if v_pieces > 0 then
    insert into public.order_notes (order_id, kind, body, created_by)
    values (p_order, 'system', 'Partial delivery: ' || v_pieces || ' unsold piece(s) came back and were put back in stock.', null);
  end if;
  return v_pieces;
end;
$$;
revoke execute on function public.restock_partial_leftover(uuid) from public, anon, authenticated;
grant execute on function public.restock_partial_leftover(uuid) to service_role;

-- The courier sync (as in 0079): when the rest of a partial delivery is back, restock it.
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
  if o.status = 'delivered' and v_to = 'returned' then
    -- Delivered, then "returned": the unsold part of a partial delivery (back into stock),
    -- or the old product of an exchange, has reached the shop. The order stays Delivered.
    if coalesce(v_outcome, o.courier_outcome) = 'partial' then
      perform public.restock_partial_leftover(o.id);
    end if;
  elsif v_to is not null and v_to <> o.status and o.deleted_at is null
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

-- A partial delivery whose rest is already back: restock it now.
select o.public_ref, public.restock_partial_leftover(o.id) as pieces_back
  from public.orders o
 where o.courier_outcome = 'partial' and o.status = 'delivered' and not o.leftover_restocked
   and o.courier_status ~* 'returned';
