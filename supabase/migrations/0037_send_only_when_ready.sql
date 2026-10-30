-- 0037 — Only orders that are Ready to deliver (processing) can go to a courier. Safe to run again.
do $$
declare
  v_def text := pg_get_functiondef('public.begin_courier_send(uuid)'::regprocedure);
  v_old text := 'o.status not in (''pending'', ''confirmed'', ''processing'', ''hold'', ''ship_later'')';
  v_new text := 'o.status <> ''processing''';
begin
  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'begin_courier_send has changed: status check not found';
  end if;
end $$;
