-- 0031 — Dashboard counts skip deleted orders. Safe to run again.
-- dashboard_stats() counted every order with status 'pending', so an order that
-- was deleted (in the trash) still showed as "1 new order waiting to be confirmed".
-- Patched in place: each "from public.orders where" also requires deleted_at is null.
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.dashboard_stats()'::regprocedure) into def;
  if position('deleted_at is null' in def) = 0 then
    def := replace(def, 'from public.orders where ', 'from public.orders where deleted_at is null and ');
    execute def;
  end if;
end;
$$;
