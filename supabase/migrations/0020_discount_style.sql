-- How a product's discount badge reads: "20% OFF" (percent) or "৳200 OFF" (amount).
-- The admin picks it when entering the discount; prices stay in base_price / compare_at_price.
alter table public.products
  add column if not exists discount_style text not null default 'percent'
  check (discount_style in ('percent', 'amount'));
