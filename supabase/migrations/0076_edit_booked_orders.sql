-- 0076 — Staff can edit an order (items, prices, delivery, discount) after it
-- has been booked with a courier, as long as it is still open (New, Confirmed,
-- Ready to deliver, Hold, Ship later). The amount on the courier's side is
-- then fixed by hand in the courier's panel. Changes only admin_save_order.
-- Safe to run again.

do $$
declare
  v_def text := pg_get_functiondef('public.admin_save_order(uuid, jsonb)'::regprocedure);
  v_old text := $o$if v_order.status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') or v_order.courier_consignment_id is not null then$o$;
  v_new text := $n$if v_order.status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') then$n$;
begin
  if position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  elsif position(v_new in v_def) > 0 then
    null; -- already changed
  else
    raise exception 'admin_save_order is not the expected version — nothing was changed';
  end if;
end $$;
