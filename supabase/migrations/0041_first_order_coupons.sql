-- 0041 — Coupons can be limited to a customer's first order, and the WELCOME10
-- code for the leaving-the-site popup. Safe to run again.
alter table public.coupons add column if not exists first_order_only boolean not null default false;

-- Checked when the order is placed, the first moment the phone number is known.
-- Cancelled, fake and deleted orders were never received, so they do not count as a first order.
do $$
declare
  v_def text := pg_get_functiondef('public.place_order(jsonb, text)'::regprocedure);
  v_old text := 'update public.coupons c set used_count = c.used_count + 1 where c.code = v_code;';
  v_new text := 'if (select c.first_order_only from public.coupons c where c.code = v_code)
       and exists (select 1 from public.orders o where o.customer_phone = v_phone and o.deleted_at is null and o.status not in (''cancelled'', ''fake'')) then
      raise exception using message = ''COUPON_INVALID'', detail = jsonb_build_object(''field'', ''coupon_code'', ''reason'', ''This code is for a first order only'')::text;
    end if;
    update public.coupons c set used_count = c.used_count + 1 where c.code = v_code;';
begin
  if position('first_order_only' in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'place_order has changed: coupon step not found';
  end if;
end $$;

insert into public.coupons (code, kind, value, first_order_only, is_active)
values ('WELCOME10', 'percent', 10, true, true)
on conflict (code) do nothing;
