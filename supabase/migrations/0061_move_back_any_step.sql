-- Every working status can move back to an earlier step (never to New), as
-- In courier already can: Ready to deliver → Confirmed; Delivered and Lost →
-- Confirmed, Ready to deliver, In courier, Hold or Ship later. Cancelled,
-- Return and Fake stay final (their stock went back to the shelf).
-- Stock is not touched by these moves: all of those steps keep the units
-- reserved. Moving back from Delivered also undoes the "paid in full" that
-- delivery wrote (the cash was not collected after all). Safe to run again.

create or replace function public.allowed_next_statuses(p_from public.order_status)
returns public.order_status[]
language sql
immutable
set search_path = ''
as $$
  select case p_from::text
    when 'pending'    then array['confirmed','processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'confirmed'  then array['processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'processing' then array['confirmed','shipped','delivered','hold','ship_later','cancelled']
    when 'hold'       then array['pending','confirmed','processing','shipped','ship_later','cancelled','fake']
    when 'ship_later' then array['pending','confirmed','processing','shipped','hold','cancelled','fake']
    when 'shipped'    then array['confirmed','processing','hold','ship_later','delivered','returned','lost']
    when 'delivered'  then array['confirmed','processing','shipped','hold','ship_later','returned','lost']
    when 'lost'       then array['confirmed','processing','shipped','hold','ship_later','delivered','returned']
    else array[]::text[]
  end::public.order_status[];
$$;
revoke execute on function public.allowed_next_statuses(public.order_status) from public, anon;
grant execute on function public.allowed_next_statuses(public.order_status) to authenticated;

-- What was paid before delivery marked the order paid in full (an advance, or nothing).
alter table public.orders add column if not exists paid_before_delivery numeric(12,2);

create or replace function public.orders_delivery_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.paid_before_delivery := old.paid_amount;
  elsif old.status = 'delivered' and new.status not in ('delivered', 'returned') then
    -- Not delivered after all: back to what had really been paid.
    new.paid_amount := least(new.paid_amount, coalesce(old.paid_before_delivery, 0));
    new.paid_before_delivery := null;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_delivery_payment on public.orders;
create trigger orders_delivery_payment before update of status on public.orders
  for each row execute function public.orders_delivery_payment();
