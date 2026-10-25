-- 0014 — One "mother" SKU per product (SKU-0008) and variation SKUs built
-- from it (SKU-0008-01, SKU-0008-02, …).
--
-- Every existing product gets a SKU in creation order and its variations
-- are renumbered under it. Orders keep the SKU they were placed with
-- (order_items.sku is a copy), so past orders do not change.

-- Next product SKU: SKU-0001, SKU-0002, … (more digits when needed),
-- skipping any already used.
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
    exit when not exists (select 1 from public.products p where p.sku = v);
  end loop;
  return v;
end;
$$;

-- ------------------------------------------------------------ products.sku
alter table public.products add column if not exists sku text;

with ordered as (
  select id, row_number() over (order by created_at, id) as n from public.products
)
update public.products p
   set sku = 'SKU-' || lpad(o.n::text, greatest(4, length(o.n::text)), '0')
  from ordered o
 where o.id = p.id;

select setval('public.sku_seq', greatest((select count(*) from public.products), 1), (select count(*) > 0 from public.products));

alter table public.products alter column sku set default public.next_sku();
alter table public.products alter column sku set not null;
alter table public.products add constraint products_sku_key unique (sku);
alter table public.products add constraint products_sku_len check (char_length(sku) between 1 and 64);

-- ------------------------------------------------------- variation SKUs
-- A variation saved without a SKU gets <product SKU>-NN, numbered after the
-- highest one the product already has.
alter table public.product_variants alter column sku drop default;

create or replace function public.variant_sku_default()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_n int;
begin
  if new.sku is not null and btrim(new.sku) <> '' then
    return new;
  end if;
  select p.sku into v_base from public.products p where p.id = new.product_id;
  select coalesce(max((regexp_match(pv.sku, '-([0-9]+)$'))[1]::int), 0) + 1
    into v_n
    from public.product_variants pv
   where pv.product_id = new.product_id
     and left(pv.sku, length(v_base) + 1) = v_base || '-';
  loop
    new.sku := v_base || '-' || lpad(v_n::text, greatest(2, length(v_n::text)), '0');
    exit when not exists (select 1 from public.product_variants pv where pv.sku = new.sku);
    v_n := v_n + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists product_variants_sku_default on public.product_variants;
create trigger product_variants_sku_default
  before insert on public.product_variants
  for each row execute function public.variant_sku_default();

-- Renumber the existing variations under their product's SKU. A temporary
-- value first, so the unique constraint never sees a clash midway.
update public.product_variants set sku = 'TMP-' || id::text;

with ordered as (
  select v.id, p.sku as base,
         row_number() over (partition by v.product_id order by v.created_at, v.id) as n
    from public.product_variants v
    join public.products p on p.id = v.product_id
)
update public.product_variants v
   set sku = o.base || '-' || lpad(o.n::text, greatest(2, length(o.n::text)), '0')
  from ordered o
 where o.id = v.id;
