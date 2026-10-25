-- 0032 — Reports skip deleted orders. Safe to run again.
-- report_summary() and report_products() (Admin › Reports) still counted orders in
-- the trash. Patched in place, like 0031: every read of public.orders also requires
-- deleted_at is null.
do $$
declare
  fn regprocedure;
  def text;
begin
  foreach fn in array array['public.report_summary(date, date)'::regprocedure, 'public.report_products(date, date)'::regprocedure] loop
    select pg_get_functiondef(fn) into def;
    if position('deleted_at is null' in def) = 0 then
      -- "from public.orders where …" and "from public.orders o where o.…"
      def := regexp_replace(def, 'from public\.orders where ', 'from public.orders where deleted_at is null and ', 'g');
      def := regexp_replace(def, 'from public\.orders o\s+where ', 'from public.orders o where o.deleted_at is null and ', 'g');
      -- report_products joins orders as o.
      def := regexp_replace(def, 'join public\.orders o on o\.id = oi\.order_id\s+where ', 'join public.orders o on o.id = oi.order_id where o.deleted_at is null and ', 'g');
      execute def;
    end if;
  end loop;
end;
$$;
