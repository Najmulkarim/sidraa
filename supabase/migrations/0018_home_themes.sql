-- 0018 — Home page themes. Each theme has its own list of sections (so
-- switching never loses another theme's arrangement); store_settings.home_theme
-- picks the one the shop shows. Two more section types: a countdown deal and
-- a newsletter band.

alter table public.store_settings
  add column if not exists home_theme text not null default 'luxora'
  check (home_theme in ('luxora', 'shopease', 'luxe', 'novatrend'));

alter table public.home_sections
  add column if not exists theme text not null default 'luxora'
  check (theme in ('luxora', 'shopease', 'luxe', 'novatrend'));
create index if not exists home_sections_theme_idx on public.home_sections (theme, sort_order);

alter table public.home_sections drop constraint if exists home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check
  check (type in ('hero', 'quick_links', 'notice', 'benefits', 'category_tiles', 'collection', 'product_row', 'banners', 'about', 'testimonials', 'gallery', 'deal', 'newsletter'));

-- Starting sections for the three new themes (once).
insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  -- ShopEase: dark hero card, benefit panel, category cards, deal of the day, new arrivals, newsletter band
  ('shopease', 'hero', 'Shop more, save more!', 'Discover amazing deals on your favourite products — pay cash when it arrives.', true, 10, '{"slides": [], "button": "Explore collection", "link": "/products"}'::jsonb),
  ('shopease', 'benefits', null, null, true, 20, '{}'::jsonb),
  ('shopease', 'category_tiles', 'Shop by category', null, true, 30, '{"category_ids": []}'::jsonb),
  ('shopease', 'deal', 'Grab it before it''s gone!', 'Hurry! Limited stock available.', true, 40, '{"source": "sale", "product_ids": [], "category_id": null, "limit": 1, "ends_at": null, "eyebrow": "Deal of the day", "link": "/products?sort=price-asc"}'::jsonb),
  ('shopease', 'product_row', 'New arrivals', null, true, 50, '{"source": "new", "limit": 8, "product_ids": [], "category_id": null, "link": "/products?sort=new", "autoplay": false}'::jsonb),
  ('shopease', 'newsletter', 'Get exclusive offers & updates', 'Sign up now and hear about new arrivals and offers first.', true, 60, '{}'::jsonb),
  -- Luxe: split hero, category circles, three promo cards, best sellers, benefit strip, reviews, newsletter band
  ('luxe', 'hero', 'Discover your style. Live luxe.', 'Premium quality fashion for modern lifestyles.', true, 10, '{"slides": [], "button": "Shop now", "link": "/products"}'::jsonb),
  ('luxe', 'category_tiles', null, null, true, 20, '{"category_ids": []}'::jsonb),
  ('luxe', 'banners', null, null, true, 30, '{"items": [{"image": null, "title": "New season collection", "subtitle": "Fresh styles for every moment.", "link": "/products?sort=new"}, {"image": null, "title": "Everyday essentials", "subtitle": "Timeless looks for every day.", "link": "/products"}, {"image": null, "title": "Best prices", "subtitle": "Don''t miss our current offers.", "link": "/products?sort=price-asc"}]}'::jsonb),
  ('luxe', 'product_row', 'Best sellers', null, true, 40, '{"source": "featured", "limit": 10, "product_ids": [], "category_id": null, "link": "/products", "autoplay": true}'::jsonb),
  ('luxe', 'benefits', null, null, true, 50, '{}'::jsonb),
  ('luxe', 'testimonials', 'What our customers say', null, true, 60, '{"items": [], "products_title": "", "source": "manual", "limit": 4, "product_ids": [], "category_id": null}'::jsonb),
  ('luxe', 'newsletter', 'Join our newsletter', 'Be the first to hear about new arrivals and exclusive offers.', true, 70, '{}'::jsonb),
  -- NovaTrend: hero with floating product cards, benefits, category cards, new arrivals, best sellers, flash deal + new collection banner
  ('novatrend', 'hero', 'Discover products you''ll love', 'Shop the latest trending products curated for modern lifestyles.', true, 10, '{"slides": [], "button": "Shop now", "link": "/products"}'::jsonb),
  ('novatrend', 'benefits', null, null, true, 20, '{}'::jsonb),
  ('novatrend', 'category_tiles', 'Shop by categories', null, true, 30, '{"category_ids": []}'::jsonb),
  ('novatrend', 'product_row', 'New arrivals', null, true, 40, '{"source": "new", "limit": 10, "product_ids": [], "category_id": null, "link": "/products?sort=new", "autoplay": true}'::jsonb),
  ('novatrend', 'collection', 'Best sellers', null, true, 50, '{"source": "featured", "limit": 3, "product_ids": [], "category_id": null, "image": null, "link": "/products"}'::jsonb),
  ('novatrend', 'deal', 'Flash sale', 'Our best prices, for a short time.', true, 60, '{"source": "sale", "product_ids": [], "category_id": null, "limit": 1, "ends_at": null, "eyebrow": "Flash sale", "link": "/products?sort=price-asc"}'::jsonb),
  ('novatrend', 'banners', 'New collection', null, true, 70, '{"items": [{"image": null, "title": "This season''s collection", "subtitle": "Discover the latest trends and fresh styles.", "link": "/products?sort=new"}]}'::jsonb)
) as seed(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme <> 'luxora');
