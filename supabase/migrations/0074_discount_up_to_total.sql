-- 0074 — A staff discount can cover the delivery charge too: up to the whole
-- order (products + delivery), so an order can be made free. Before, the
-- discount could not be more than the products alone. The total never goes
-- below 0 (the orders table still checks total >= 0 and total = subtotal −
-- discount + delivery). Changes only admin_save_order. Safe to run again.

do $$
declare
  v_def text := pg_get_functiondef('public.admin_save_order(uuid, jsonb)'::regprocedure);
  -- 1. The early check: only "0 or more" now; the upper limit moves below, once the delivery charge is known.
  v_old1 text := $o$  if v_discount < 0 or v_discount > v_subtotal or round(v_discount, 2) <> v_discount then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'discount', 'reason', 'Discount must be between 0 and the items total')::text;
  end if;$o$;
  v_new1 text := $n$  if v_discount < 0 or round(v_discount, 2) <> v_discount then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'discount', 'reason', 'Discount must be 0 or more')::text;
  end if;$n$;
  -- 2. The delivery area's free-delivery threshold looks at the goods after discount, never below 0.
  v_old2 text := $o$v_delivery := public.delivery_charge_for(v_zone.charge, v_zone.free_over, v_subtotal - v_discount);
  end if;
  v_total := v_subtotal - v_discount + v_delivery;$o$;
  v_new2 text := $n$v_delivery := public.delivery_charge_for(v_zone.charge, v_zone.free_over, greatest(v_subtotal - v_discount, 0));
  end if;
  -- The discount may cover the products and the delivery charge, never more.
  if v_discount > v_subtotal + v_delivery then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'discount', 'reason', 'Discount cannot be more than the order total (products + delivery)')::text;
  end if;
  v_total := v_subtotal - v_discount + v_delivery;$n$;
begin
  if position('v_discount > v_subtotal + v_delivery' in v_def) > 0 then
    null; -- already changed
  elsif position(v_old1 in v_def) > 0 and position(v_old2 in v_def) > 0 then
    execute replace(replace(v_def, v_old1, v_new1), v_old2, v_new2);
  else
    raise exception 'admin_save_order is not the expected version — nothing was changed';
  end if;
end $$;
