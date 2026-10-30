-- 0038 — An order whose pickup the courier cancelled can be reopened. Stock is
-- held again and the old courier booking is cleared, so it can be sent again.
-- Other cancelled orders stay final. Safe to run again.
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns public.order_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_problems jsonb;
begin
  perform public.require_permission('orders');
  select * into o from public.orders where id = p_order_id for update;

  if not found or o.deleted_at is not null or o.status <> 'cancelled'
     or coalesce(o.courier_status, '') !~* 'pickup[^a-z]*cancel'
     or p_status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') then
    return public.apply_order_status(p_order_id, p_status, p_note, auth.uid());
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Note is too long')::text;
  end if;

  perform 1 from public.product_variants v
   where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
   order by v.id for update;

  -- Same stock rule as a new order; a line whose product was deleted cannot come back.
  select jsonb_agg(jsonb_build_object(
           'variant_id', q.variant_id, 'product_name', coalesce(p.name, q.product_name),
           'variant_label', q.variant_label, 'requested', q.qty, 'available', coalesce(v.stock, 0)))
    into v_problems
    from (select oi.variant_id, max(oi.product_name) as product_name, max(oi.variant_label) as variant_label, sum(oi.quantity)::int as qty
            from public.order_items oi where oi.order_id = p_order_id group by oi.variant_id) q
    left join public.product_variants v on v.id = q.variant_id
    left join public.products p on p.id = v.product_id
   where v.id is null or not v.is_active or p.status = 'archived'
      or (v.stock < q.qty and p.stock_out_mode = 'sold_out');
  if v_problems is not null then
    raise exception using message = 'OUT_OF_STOCK', detail = v_problems::text;
  end if;

  if o.stock_released then
    update public.product_variants v
       set stock = v.stock - q.qty
      from (select oi.variant_id, sum(oi.quantity)::int as qty from public.order_items oi
             where oi.order_id = p_order_id group by oi.variant_id) q
     where v.id = q.variant_id;

    insert into public.inventory_movements (variant_id, change, reason, order_id, created_by, note)
    select oi.variant_id, -sum(oi.quantity)::int, 'order', p_order_id, auth.uid(), 'Reopened after pickup cancel'
      from public.order_items oi where oi.order_id = p_order_id group by oi.variant_id;
  end if;

  update public.orders set
    status = p_status,
    stock_released = false,
    cancelled_at = null,
    confirmed_at  = case when p_status = 'confirmed'  then now() else confirmed_at  end,
    processing_at = case when p_status = 'processing' then now() else processing_at end,
    hold_at       = case when p_status in ('hold', 'ship_later') then now() else hold_at end,
    courier = null, courier_consignment_id = null, courier_tracking_code = null, courier_status = null,
    courier_charge = null, courier_sent_at = null, courier_synced_at = null, courier_lock_at = null, courier_error = null
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'cancelled', p_status, auth.uid(), coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Reopened after pickup cancel'));
  insert into public.order_notes (order_id, kind, body, created_by)
  values (p_order_id, 'system', left('Reopened after pickup cancel. Old booking: ' || initcap(coalesce(o.courier, '')) || ' ' || coalesce(o.courier_consignment_id, ''), 1000), auth.uid());

  return p_status;
end;
$$;
revoke execute on function public.set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
