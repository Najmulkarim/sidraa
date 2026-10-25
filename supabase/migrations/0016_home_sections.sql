-- 0016 — Home page builder. Each row is one section of the home page:
-- its type, heading, on/off switch, position and type-specific settings
-- (slides, links, banner images, which products to show and in what order).
--
-- Visitors read enabled sections only; staff with the store_settings
-- permission read and change all of them.

create table if not exists public.home_sections (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('hero', 'quick_links', 'notice', 'benefits', 'category_tiles', 'collection', 'product_row', 'banners', 'about')),
  title       text check (char_length(title) <= 120),
  subtitle    text check (char_length(subtitle) <= 600),
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists home_sections_order_idx on public.home_sections (sort_order);

drop trigger if exists home_sections_updated_at on public.home_sections;
create trigger home_sections_updated_at before update on public.home_sections
  for each row execute function public.set_updated_at();

alter table public.home_sections enable row level security;

drop policy if exists home_sections_read on public.home_sections;
create policy home_sections_read on public.home_sections
  for select to anon, authenticated
  using (enabled or (select public.has_permission('store_settings')));

drop policy if exists home_sections_write on public.home_sections;
create policy home_sections_write on public.home_sections
  for all to authenticated
  using ((select public.has_permission('store_settings')))
  with check ((select public.has_permission('store_settings')));

grant select on public.home_sections to anon, authenticated;
grant insert, update, delete on public.home_sections to authenticated;

-- Starting layout: what the home page showed before, plus the new section types.
insert into public.home_sections (type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('hero', 'Elevate your everyday style', 'Fashion for every mood and moment. Order in a minute, pay in cash at your door.', true, 10,
     '{"slides": [], "button": "Shop now", "link": "/products"}'::jsonb),
  ('quick_links', null, null, true, 20,
     '{"links": [{"label": "Shop all", "href": "/products"}, {"label": "New in", "href": "/products?sort=new"}, {"label": "Best price", "href": "/products?sort=price-asc"}, {"label": "Track order", "href": "/track"}]}'::jsonb),
  ('notice', null, 'Cash on delivery all over Bangladesh. Check the parcel before you pay.', false, 30,
     '{"link_label": "How it works", "link": "/info/delivery"}'::jsonb),
  ('benefits', null, null, true, 40, '{}'::jsonb),
  ('category_tiles', 'Shop by category', null, true, 50, '{"category_ids": []}'::jsonb),
  ('collection', 'Trending now', 'Our most-loved picks this week', true, 60,
     '{"source": "featured", "limit": 7, "product_ids": [], "image": null, "link": "/products"}'::jsonb),
  ('banners', null, null, true, 70,
     '{"items": [{"image": "/demo/promo-1.svg", "title": "Dresses", "subtitle": "Light, breezy & beautiful", "link": "/category/dresses"}, {"image": "/demo/promo-2.svg", "title": "New arrivals", "subtitle": "Fresh styles just for you", "link": "/products?sort=new"}, {"image": "/demo/promo-3.svg", "title": "Ethnic wear", "subtitle": "Shine on every occasion", "link": "/category/ethnic-wear"}]}'::jsonb),
  ('product_row', 'New arrivals', null, true, 80, '{"source": "new", "limit": 10, "product_ids": []}'::jsonb),
  ('about', 'Made to feel good, priced to feel better', 'We pick every piece for comfort, fit and finish, check it before it ships, and let you check it again at your door before you pay.', true, 90,
     '{"image": null, "link": "/info/delivery", "link_label": "How we deliver"}'::jsonb),
  ('collection', 'On sale', 'Grab them before they are gone', true, 100,
     '{"source": "sale", "limit": 7, "product_ids": [], "image": null, "link": "/products?sort=price-asc"}'::jsonb)
) as seed(type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections);
