-- Storefront settings (header / footer parts on or off, fonts, favicon, share
-- image, country, invoice template …) kept as one JSON object that the app
-- validates, plus a changeable order-number prefix.
begin;

alter table public.store_settings
  add column if not exists storefront jsonb not null default '{}'::jsonb,
  -- "Order" → Order0001. Any other prefix is stored in capitals: SDR → SDR0001.
  add column if not exists order_number_prefix text not null default 'Order'
    check (order_number_prefix = 'Order' or order_number_prefix ~ '^[A-Z]{2,10}$');

-- New orders take the prefix from settings; the running number continues.
create or replace function public.generate_public_ref(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  n bigint := nextval('public.order_number_seq');
  pre text;
begin
  select s.order_number_prefix into pre from public.store_settings s where s.id = 1;
  return coalesce(pre, 'Order') || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

-- Tracking accepts "Order0001", "order 1", "SDR0001", "sdr-1", plain "0001",
-- and the old "SD-7K2M-9QXA" references.
create or replace function public.canonical_public_ref(p text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  x text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
  letters text;
  digits text;
  body text;
  pre text;
begin
  if x ~ '^[A-Z]{0,10}[0-9]{1,12}$' then
    letters := substring(x from '^[A-Z]*');
    digits := ltrim(substring(x from '[0-9]+$'), '0');
    if digits = '' then
      return null;
    end if;
    if letters = '' then
      select s.order_number_prefix into pre from public.store_settings s where s.id = 1;
      letters := upper(coalesce(pre, 'Order'));
    end if;
    return case when letters = 'ORDER' then 'Order' else letters end || lpad(digits, greatest(4, length(digits)), '0');
  end if;
  if length(x) < 10 or length(x) > 12 then
    return null;
  end if;
  body := translate(right(x, 8), 'OIL', '011');
  return left(x, length(x) - 8) || '-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

commit;
