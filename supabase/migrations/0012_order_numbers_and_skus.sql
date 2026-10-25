-- 0012 — Sequential order numbers (Order0001, Order0002, …) and automatic
-- SKUs (SKU000001, SKU000002, …).
--
-- Orders placed before this migration keep their old references
-- (SD-7K2M-9QXA); tracking accepts both forms. The order_ref_prefix
-- setting is no longer used for new orders.

-- ------------------------------------------------------------ order numbers
create sequence if not exists public.order_number_seq;

-- Same signature as before, so place_order() and admin_save_order() pick it
-- up unchanged. Both still loop until the reference is unused.
create or replace function public.generate_public_ref(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  n bigint := nextval('public.order_number_seq');
begin
  return 'Order' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

-- Accepts "Order0001", "order 1", "ORDER-0001" and plain "1" / "0001" for
-- new orders, and "sd 7k2m 9qxa", "SD7K2M9QXA", "SD-7K2M-9QXA" for old ones.
create or replace function public.canonical_public_ref(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  x text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
  digits text;
  body text;
begin
  if x ~ '^(ORDER)?[0-9]{1,12}$' then
    digits := ltrim(regexp_replace(x, '^ORDER', ''), '0');
    if digits = '' then
      return null;
    end if;
    return 'Order' || lpad(digits, greatest(4, length(digits)), '0');
  end if;
  if length(x) < 10 or length(x) > 12 then
    return null;
  end if;
  body := translate(right(x, 8), 'OIL', '011');
  return left(x, length(x) - 8) || '-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

-- --------------------------------------------------------------------- SKUs
create sequence if not exists public.sku_seq;

-- Next free SKU000001-style code, skipping any typed in by hand.
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
    v := 'SKU' || lpad(n::text, greatest(6, length(n::text)), '0');
    exit when not exists (select 1 from public.product_variants pv where pv.sku = v);
  end loop;
  return v;
end;
$$;

revoke execute on function public.next_sku() from public, anon;
grant execute on function public.next_sku() to authenticated, service_role;

-- A variant inserted without a SKU gets the next one.
alter table public.product_variants alter column sku set default public.next_sku();
