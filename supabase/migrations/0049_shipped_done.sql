-- "Shipped done": the parcel has physically left the house (handed to the rider).
-- The order stays "shipped" (In courier) for the courier updates; this only
-- marks the moment it went out, so the Orders page can show it in its own tab.

alter table public.orders add column if not exists dispatched_at timestamptz;

create index if not exists orders_dispatched_idx on public.orders (status, dispatched_at) where status = 'shipped';

-- Mark (p_done = true) or unmark a list of In courier orders. Returns how many changed.
create or replace function public.set_orders_dispatched(p_order_ids uuid[], p_done boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public.require_permission('orders');
  if coalesce(array_length(p_order_ids, 1), 0) > 200 then
    raise exception using message = 'TOO_MANY';
  end if;

  with changed as (
    update public.orders
       set dispatched_at = case when p_done then now() else null end
     where id = any (p_order_ids)
       and status = 'shipped'
       and deleted_at is null
       and (case when p_done then dispatched_at is null else dispatched_at is not null end)
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from changed;

  insert into public.order_notes (order_id, kind, body, created_by)
  select x, 'system', case when p_done then 'Shipped done (left the house)' else 'Shipped done undone' end, auth.uid()
    from unnest(v_ids) as x;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke execute on function public.set_orders_dispatched(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.set_orders_dispatched(uuid[], boolean) to authenticated;
