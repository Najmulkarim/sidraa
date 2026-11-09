-- 0063 — A paid return counts exactly what the customer paid, never a guess.
-- The courier sync no longer assumes the delivery charge was paid; it records
-- an amount only when the courier sends one (p_collected, e.g. Pathao's
-- webhook). Otherwise staff enter it in Paid on the order, and Accounting
-- lists paid returns still waiting for it. SD0012: the customer paid ৳60.
-- Safe to run again.

drop function if exists public.apply_courier_status(text, text, text, numeric);
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
                            then least(p_collected, total) else paid_amount end
   where id = o.id;
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

-- SD0012: the customer paid ৳60 at the door (0062 had assumed the ৳70 delivery charge).
update public.orders o set paid_amount = 60
 where o.public_ref = 'SD0012' and o.status = 'returned' and o.paid_amount = 70;
