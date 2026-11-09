-- In courier orders can move back to any earlier step except New
-- (Confirmed, Ready to deliver, Hold, Ship later), as well as forward
-- (Delivered, Return, Lost). Stock is not touched: those steps all keep the
-- units reserved, exactly as In courier does. Safe to run again.

create or replace function public.allowed_next_statuses(p_from public.order_status)
returns public.order_status[]
language sql
immutable
set search_path = ''
as $$
  select case p_from::text
    when 'pending'    then array['confirmed','processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'confirmed'  then array['processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'processing' then array['shipped','delivered','hold','ship_later','cancelled']
    when 'hold'       then array['pending','confirmed','processing','shipped','ship_later','cancelled','fake']
    when 'ship_later' then array['pending','confirmed','processing','shipped','hold','cancelled','fake']
    when 'shipped'    then array['confirmed','processing','hold','ship_later','delivered','returned','lost']
    when 'delivered'  then array['returned']
    else array[]::text[]
  end::public.order_status[];
$$;
revoke execute on function public.allowed_next_statuses(public.order_status) from public, anon;
grant execute on function public.allowed_next_statuses(public.order_status) to authenticated;

-- Leaving In courier clears "Shipped done", so the next time it goes out it is marked afresh.
create or replace function public.orders_clear_dispatched()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'shipped' and new.status is distinct from 'shipped' and new.status not in ('delivered', 'returned', 'lost') then
    new.dispatched_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_clear_dispatched on public.orders;
create trigger orders_clear_dispatched before update of status on public.orders
  for each row execute function public.orders_clear_dispatched();
