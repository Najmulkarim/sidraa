-- 0040 — A pickup the courier cancelled says nothing about the customer (the parcel
-- never left the shop), so it no longer lowers their success rate. Safe to run again.
create or replace function public.customer_stats(p_phones text[])
returns table (phone text, orders bigint, delivered bigint, failed bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_permission('orders');
  return query
    select o.customer_phone, count(*),
           count(*) filter (where o.status = 'delivered'),
           count(*) filter (where o.status in ('returned', 'cancelled', 'fake', 'lost')
                              and not (o.status = 'cancelled' and coalesce(o.courier_status, '') ~* 'pickup[^a-z]*cancel'))
      from public.orders o
     where o.customer_phone = any (p_phones) and o.deleted_at is null
     group by o.customer_phone;
end;
$$;
