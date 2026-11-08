-- Landing pages: a one-product sales page at /offer/<slug> (for Facebook ads),
-- with its own headline, video, points, FAQ and an order form on the page.
-- The offer is real: the product's own sale price, plus an optional coupon
-- that the page applies by itself (place_order() checks it as usual).
create table if not exists public.landing_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  product_id   uuid not null references public.products (id) on delete cascade,
  is_active    boolean not null default true,
  headline     text check (char_length(headline) <= 160),
  subheadline  text check (char_length(subheadline) <= 400),
  offer_text   text check (char_length(offer_text) <= 120),
  coupon_code  text check (coupon_code ~ '^[A-Z0-9_-]{3,24}$'),
  video_url    text check (char_length(video_url) <= 300),
  benefits     text[] not null default '{}' check (cardinality(benefits) <= 12),
  -- [{ "q": "…", "a": "…" }, …]
  faqs         jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 12),
  button_text  text check (char_length(button_text) <= 40),
  show_description boolean not null default true,
  show_reviews boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists landing_pages_updated_at on public.landing_pages;
create trigger landing_pages_updated_at before update on public.landing_pages
  for each row execute function public.set_updated_at();

alter table public.landing_pages enable row level security;

drop policy if exists landing_pages_public_read on public.landing_pages;
create policy landing_pages_public_read on public.landing_pages
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
drop policy if exists landing_pages_admin_insert on public.landing_pages;
create policy landing_pages_admin_insert on public.landing_pages
  for insert to authenticated with check ((select public.has_permission('catalog')));
drop policy if exists landing_pages_admin_update on public.landing_pages;
create policy landing_pages_admin_update on public.landing_pages
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
drop policy if exists landing_pages_admin_delete on public.landing_pages;
create policy landing_pages_admin_delete on public.landing_pages
  for delete to authenticated using ((select public.has_permission('catalog')));

grant select on public.landing_pages to anon, authenticated;
grant insert, update, delete on public.landing_pages to authenticated;

-- Which landing page an order came from (shown on the Orders page).
alter table public.orders add column if not exists landing_slug text check (char_length(landing_slug) <= 60);
