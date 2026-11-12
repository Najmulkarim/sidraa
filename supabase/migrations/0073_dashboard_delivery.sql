-- 0073 — Dashboard cards show amounts with the delivery charge inside them made
-- clear: the total value of all orders in the period, and how much of each
-- card's amount (all / active / delivered / cancelled) is delivery charge.
-- Adds keys to dashboard_report; nothing else changes. Safe to run again.

do $$
declare
  v_def text := pg_get_functiondef('public.dashboard_report(date, date)'::regprocedure);
  v_old text := $o$'total_orders',     (select count(*) from o),$o$;
  v_new text := $n$'total_orders',     (select count(*) from o),
    'total_value',      case when v_money then (select coalesce(sum(total), 0) from o) end,
    'total_delivery',   case when v_money then (select coalesce(sum(delivery_charge), 0) from o) end,
    'active_delivery',  case when v_money then (select coalesce(sum(delivery_charge), 0) from o where status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped')) end,
    'delivered_delivery', case when v_money then (select coalesce(sum(delivery_charge), 0) from o where status = 'delivered') end,
    'cancelled_delivery', case when v_money then (select coalesce(sum(delivery_charge), 0) from o where status in ('cancelled', 'fake')) end,$n$;
begin
  if position('''total_value''' in v_def) > 0 then
    null; -- already added
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'dashboard_report has changed: total_orders line not found — nothing was changed';
  end if;
end $$;
