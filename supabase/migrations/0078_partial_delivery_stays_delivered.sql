-- 0078 — A partial delivery stays Delivered.
-- After a partial delivery Pathao sends the rest of the parcel back and reports
-- "return in transit" and later "returned" for the same consignment. The sync
-- used to turn the Delivered order into Returned at that point, losing the
-- cash the customer paid (SD0128: ৳910 collected of ৳1,750).
-- Now a courier update never moves a Delivered order to Returned; staff can
-- still change the status by hand. Everything else is as in 0063.
-- Safe to run again.

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
  v_paid_return boolean := lower(coalesce(p_raw_status, '')) ~ 'paid[^a-z]*return';
begin
  select * into o from public.orders
   where courier = p_courier and courier_consignment_id = p_consignment_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  update public.orders set courier_status = left(p_raw_status, 60), courier_synced_at = now(),
         courier_charge = coalesce(p_charge, courier_charge),
         paid_amount = case when v_paid_return and p_collected is not null and p_collected >= 0
                             and o.status <> 'delivered'
                            then least(p_collected, total) else paid_amount end
   where id = o.id;
  -- Delivered, then "returned": the unsold part of a partial delivery coming back.
  if o.status = 'delivered' and v_to = 'returned' then
    return jsonb_build_object('found', true, 'status', o.status);
  end if;
  if v_to is not null and v_to <> o.status and o.deleted_at is null
     and (v_to = any (public.allowed_next_statuses(o.status)) or (o.status = 'shipped' and v_to = 'cancelled')) then
    perform public.apply_order_status(o.id, v_to, initcap(p_courier) || ': ' || left(p_raw_status, 60), null);
    return jsonb_build_object('found', true, 'status', v_to);
  end if;
  return jsonb_build_object('found', true, 'status', o.status);
end;
$$;
revoke execute on function public.apply_courier_status(text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.apply_courier_status(text, text, text, numeric, numeric) to service_role;
