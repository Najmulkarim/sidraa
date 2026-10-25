-- When a product runs out: sold_out (as before), preorder (shown as Pre-order,
-- delivered in preorder_days) or continue ("sale ongoing": sells like stock,
-- no tag). Stock may then go below zero and climbs back when restocked.
-- The order functions are patched in place; if any expected line is missing
-- the whole script stops and nothing changes.
begin;

alter table public.products
  add column if not exists stock_out_mode text not null default 'sold_out' check (stock_out_mode in ('sold_out', 'preorder', 'continue')),
  add column if not exists preorder_days int check (preorder_days between 1 and 180);

alter table public.product_variants drop constraint if exists product_variants_stock_check;
alter table public.product_variants add constraint product_variants_stock_check check (stock >= -100000);

-- Which order lines were sold beyond the stock at the time (staff see it; customers see only pre-orders).
alter table public.order_items
  add column if not exists backorder text check (backorder in ('preorder', 'continue'));

-- Facebook catalog: optional feed ID + token so "Refresh catalog" (and the daily job)
-- can ask Facebook to fetch the product feed right away.
alter table public.marketing_settings
  add column if not exists catalog_feed_id text check (catalog_feed_id ~ '^[0-9]{5,30}$'),
  add column if not exists catalog_token text check (char_length(catalog_token) <= 600),
  add column if not exists catalog_pushed_at timestamptz,
  add column if not exists catalog_push_result text check (char_length(catalog_push_result) <= 500);

do $patch$
declare
  d text;
  function_sig text;
begin
  -- quote_order: out-of-stock lines of preorder / continue products are fine to buy.
  function_sig := 'public.quote_order(jsonb,uuid,text)';
  d := pg_get_functiondef(function_sig::regprocedure);
  if d !~ $r$'line_total', coalesce\(v\.price, p\.base_price\) \* least\(l\.quantity, v\.stock\),$r$
     or d !~ $r$'stock_left', v\.stock,$r$
     or d !~ $r$'state', case when v\.stock = 0 then 'sold_out' when v\.stock < l\.quantity then 'insufficient' else 'ok' end\)$r$ then
    raise exception 'quote_order is not the expected version — nothing was changed';
  end if;
  d := regexp_replace(d, $r$'line_total', coalesce\(v\.price, p\.base_price\) \* least\(l\.quantity, v\.stock\),$r$,
    $s$'line_total', coalesce(v.price, p.base_price) * case when p.stock_out_mode = 'sold_out' then least(l.quantity, greatest(v.stock, 0)) else l.quantity end,$s$);
  d := regexp_replace(d, $r$'stock_left', v\.stock,$r$,
    $s$'stock_left', case when p.stock_out_mode = 'sold_out' then v.stock else greatest(v.stock, 0) end,$s$);
  d := regexp_replace(d, $r$'state', case when v\.stock = 0 then 'sold_out' when v\.stock < l\.quantity then 'insufficient' else 'ok' end\)$r$,
    $s$'state', case when p.stock_out_mode <> 'sold_out' then 'ok' when v.stock <= 0 then 'sold_out' when v.stock < l.quantity then 'insufficient' else 'ok' end,
            'preorder', p.stock_out_mode = 'preorder' and v.stock < l.quantity,
            'preorder_days', p.preorder_days)$s$);
  execute d;

  -- place_order: allow those lines, and remember them on the order item.
  function_sig := 'public.place_order(jsonb,text)';
  d := pg_get_functiondef(function_sig::regprocedure);
  if d !~ $r$or v\.stock < l\.quantity;$r$
     or d !~ $r$line_total\)\s+select v_order_id, p\.id, v\.id, p\.name, v\.sku,$r$
     or d !~ $r$coalesce\(v\.price, p\.base_price\) \* l\.quantity\s+from rows from$r$ then
    raise exception 'place_order is not the expected version — nothing was changed';
  end if;
  d := regexp_replace(d, $r$or v\.stock < l\.quantity;$r$, $s$or (v.stock < l.quantity and p.stock_out_mode = 'sold_out');$s$);
  d := regexp_replace(d, $r$line_total\)(\s+)select v_order_id, p\.id, v\.id, p\.name, v\.sku,$r$, $s$line_total, backorder)\1select v_order_id, p.id, v.id, p.name, v.sku,$s$);
  d := regexp_replace(d, $r$coalesce\(v\.price, p\.base_price\) \* l\.quantity(\s+)from rows from$r$,
    $s$coalesce(v.price, p.base_price) * l.quantity,
         case when v.stock < l.quantity and p.stock_out_mode <> 'sold_out' then p.stock_out_mode end\1from rows from$s$);
  execute d;

  -- admin_save_order (manual orders): same rule.
  function_sig := 'public.admin_save_order(uuid,jsonb)';
  d := pg_get_functiondef(function_sig::regprocedure);
  if d !~ $r$or v\.stock \+ coalesce\(old\.qty, 0\) < n\.quantity;$r$ then
    raise exception 'admin_save_order is not the expected version — nothing was changed';
  end if;
  d := regexp_replace(d, $r$or v\.stock \+ coalesce\(old\.qty, 0\) < n\.quantity;$r$, $s$or (v.stock + coalesce(old.qty, 0) < n.quantity and p.stock_out_mode = 'sold_out');$s$);
  execute d;

  -- adjust_stock: restocking a negative stock must be allowed; only a decrease may not go below zero.
  function_sig := 'public.adjust_stock(uuid,integer,public.movement_reason,text)';
  d := pg_get_functiondef(function_sig::regprocedure);
  if d !~ $r$if v_stock \+ p_change < 0 then$r$ then
    raise exception 'adjust_stock is not the expected version — nothing was changed';
  end if;
  d := regexp_replace(d, $r$if v_stock \+ p_change < 0 then$r$, $s$if p_change < 0 and v_stock + p_change < 0 then$s$);
  execute d;
end
$patch$;

commit;
