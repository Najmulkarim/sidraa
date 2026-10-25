-- 0013 — SKUs look like SKU-0001, SKU-0002, … and every existing variation
-- is renumbered that way (oldest product first).
--
-- Orders keep the SKU they were placed with (order_items.sku is a copy),
-- so past orders, slips and reports do not change.

-- New SKUs: SKU-0001 (four digits, more when needed), skipping any typed by hand.
create or replace function public.next_sku()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
  v text;
begin
  loop
    n := nextval('public.sku_seq');
    v := 'SKU-' || lpad(n::text, greatest(4, length(n::text)), '0');
    exit when not exists (select 1 from public.product_variants pv where pv.sku = v);
  end loop;
  return v;
end;
$$;

-- Renumber the existing variations in one go. A temporary value first, so
-- the unique constraint never sees two rows with the same new SKU.
update public.product_variants set sku = 'TMP-' || id::text;

with ordered as (
  select v.id,
         row_number() over (order by p.created_at, p.id, v.created_at, v.id) as n
    from public.product_variants v
    join public.products p on p.id = v.product_id
)
update public.product_variants v
   set sku = 'SKU-' || lpad(o.n::text, greatest(4, length(o.n::text)), '0')
  from ordered o
 where o.id = v.id;

-- The next new variation continues after the last one used.
select setval('public.sku_seq', greatest((select count(*) from public.product_variants), 1), (select count(*) > 0 from public.product_variants));
