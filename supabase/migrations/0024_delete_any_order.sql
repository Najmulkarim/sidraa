-- Any order can be deleted, whatever its status. Deleting puts the items
-- back in stock like a return (once); restoring a deleted order takes them
-- out again. The order keeps its status and history.
begin;

alter table public.orders add column if not exists released_by_delete boolean not null default false;

create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.require_permission('orders_delete');
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;

  if not v_order.stock_released then
    perform 1 from public.product_variants v
     where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
     order by v.id for update;

    update public.product_variants v
       set stock = v.stock + q.qty
      from (select oi.variant_id, sum(oi.quantity)::int as qty
              from public.order_items oi
             where oi.order_id = p_order_id and oi.variant_id is not null
             group by oi.variant_id) q
     where v.id = q.variant_id;

    insert into public.inventory_movements (variant_id, change, reason, order_id, created_by, note)
    select oi.variant_id, sum(oi.quantity)::int, 'return', p_order_id, auth.uid(), 'Order deleted'
      from public.order_items oi
     where oi.order_id = p_order_id and oi.variant_id is not null
     group by oi.variant_id;
  end if;

  update public.orders
     set deleted_at = now(),
         released_by_delete = not v_order.stock_released,
         stock_released = true
   where id = p_order_id;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (p_order_id, 'system', case when v_order.stock_released then 'Order deleted' else 'Order deleted — items put back in stock' end, auth.uid());
end;
$$;

create or replace function public.restore_order(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.require_permission('orders_delete');
  select * into v_order from public.orders where id = p_order_id and deleted_at is not null for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;

  -- Stock that came back because of the delete goes out again.
  if v_order.released_by_delete then
    perform 1 from public.product_variants v
     where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
     order by v.id for update;

    update public.product_variants v
       set stock = v.stock - q.qty
      from (select oi.variant_id, sum(oi.quantity)::int as qty
              from public.order_items oi
             where oi.order_id = p_order_id and oi.variant_id is not null
             group by oi.variant_id) q
     where v.id = q.variant_id;

    insert into public.inventory_movements (variant_id, change, reason, order_id, created_by, note)
    select oi.variant_id, -sum(oi.quantity)::int, 'order', p_order_id, auth.uid(), 'Order restored'
      from public.order_items oi
     where oi.order_id = p_order_id and oi.variant_id is not null
     group by oi.variant_id;
  end if;

  update public.orders
     set deleted_at = null,
         stock_released = case when v_order.released_by_delete then false else stock_released end,
         released_by_delete = false
   where id = p_order_id;
  insert into public.order_notes (order_id, kind, body, created_by) values (p_order_id, 'system', 'Order restored', auth.uid());
end;
$$;

commit;
