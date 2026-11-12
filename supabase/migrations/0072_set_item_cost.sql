-- 0072 — Correct the cost of one sold item (what that piece cost the shop),
-- from Accounting's order-by-order list. The order's notes say who changed it,
-- from what and to what. Safe to run again.

create or replace function public.set_order_item_cost(p_item_id uuid, p_cost numeric)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item public.order_items%rowtype;
begin
  perform public.require_permission('revenue');
  if p_cost is null or p_cost < 0 or p_cost > 9999999 or round(p_cost, 2) <> p_cost then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'cost', 'reason', 'Cost must be 0 or more')::text;
  end if;
  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  update public.order_items set unit_cost = p_cost where id = p_item_id;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (v_item.order_id, 'system',
          'Cost of ' || v_item.product_name || coalesce(' (' || nullif(v_item.variant_label, '') || ')', '') ||
          ' set to ৳' || p_cost::text || ' a piece (was ' || coalesce('৳' || v_item.unit_cost::text, 'not set') || ')',
          auth.uid());
  return p_cost;
end;
$$;
revoke execute on function public.set_order_item_cost(uuid, numeric) from public, anon;
grant execute on function public.set_order_item_cost(uuid, numeric) to authenticated;
