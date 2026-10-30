-- 0039 — Supabase refuses an UPDATE without a WHERE for API calls, so creating
-- or editing an order by hand failed with "UPDATE requires a WHERE clause". Safe to run again.
do $$
declare
  v_def text := pg_get_functiondef('public.admin_save_order(uuid, jsonb)'::regprocedure);
  v_old text := 'where v.id = n.variant_id));';
  v_new text := 'where v.id = n.variant_id))
   where true;';
begin
  if position(v_new in v_def) > 0 then
    null;
  elsif position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  else
    raise exception 'admin_save_order has changed: price update not found';
  end if;
end $$;
