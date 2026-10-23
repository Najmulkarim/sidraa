-- 0002 — catalogue: categories, products, images, variants.
-- Inventory lives on product_variants. Every product has at least one
-- variant; a product without sizes gets a single "default" variant.

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 2000),
  image_path  text,
  sort_order  int  not null default 0,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index categories_public_sort_idx on public.categories (is_public, sort_order);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null check (char_length(name) between 1 and 160),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text check (char_length(description) <= 10000),
  base_price       numeric(12,2) not null check (base_price >= 0),
  compare_at_price numeric(12,2),
  status           public.product_status not null default 'draft',
  is_featured      boolean not null default false,
  seo_title        text check (char_length(seo_title) <= 70),
  seo_description  text check (char_length(seo_description) <= 170),
  -- Names of the up-to-three variation types, e.g. Colour / Size / Sleeve.
  color_label      text not null default 'Color' check (char_length(color_label) between 1 and 20),
  size_label       text not null default 'Size' check (char_length(size_label) between 1 and 20),
  option3_label    text check (char_length(option3_label) between 1 and 20),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_compare_price_chk
    check (compare_at_price is null or compare_at_price > base_price)
);
create index products_status_category_idx  on public.products (status, category_id);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_featured_idx         on public.products (is_featured) where status = 'published';
create index products_name_trgm_idx        on public.products using gin (name extensions.gin_trgm_ops);

-- published_at is stamped the first time a product is published.
create or replace function public.products_stamp_published()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger products_stamp_published
  before insert or update of status on public.products
  for each row execute function public.products_stamp_published();

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 300),
  alt          text check (char_length(alt) <= 200),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (product_id, sort_order) deferrable initially deferred
);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku        text not null unique check (char_length(sku) between 1 and 64),
  size       text not null default '' check (char_length(size) <= 20),
  color      text not null default '' check (char_length(color) <= 30),
  -- Third variation type (named by products.option3_label), e.g. "Full sleeve".
  option3    text not null default '' check (char_length(option3) <= 30),
  -- Photo for this variation: one of the product's own photos (trigger below).
  image_path text check (char_length(image_path) <= 300),
  price      numeric(12,2) check (price is null or price >= 0),
  stock      int  not null default 0 check (stock >= 0),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size, option3)
);
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_low_stock_idx on public.product_variants (stock) where is_active;

create trigger categories_updated_at       before update on public.categories       for each row execute function public.set_updated_at();
create trigger products_updated_at         before update on public.products         for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

-- "Red / XL / Full sleeve" — the label shown in the cart, on orders and slips.
create or replace function public.variant_label(p_color text, p_size text, p_option3 text)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(' / ', nullif(p_color, ''), nullif(p_size, ''), nullif(p_option3, ''));
$$;

-- A variation photo must be one of the same product's photos.
create or replace function public.check_variant_image()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_path is not null and not exists (
    select 1 from public.product_images i where i.product_id = new.product_id and i.storage_path = new.image_path
  ) then
    raise exception using message = 'INVALID_INPUT',
      detail = jsonb_build_object('field', 'image_path', 'reason', 'Pick one of this product''s photos')::text;
  end if;
  return new;
end;
$$;
create trigger product_variants_image_chk before insert or update of image_path, product_id on public.product_variants
  for each row execute function public.check_variant_image();

-- Deleting a photo clears it from the variations that used it.
create or replace function public.clear_variant_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.product_variants set image_path = null
   where product_id = old.product_id and image_path = old.storage_path;
  return old;
end;
$$;
create trigger product_images_clear_variant after delete on public.product_images
  for each row execute function public.clear_variant_image();
