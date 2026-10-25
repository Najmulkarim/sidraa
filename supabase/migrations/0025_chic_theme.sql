-- 0025 — Two more home themes. Safe to run again: constraints are replaced
-- and each theme's sections are added only if that theme has none yet.
--   chic:   hero on a big colour circle, benefits card over the hero, pastel
--           category cards, new arrivals, offer band, all products, benefits strip.
--   market: mini category tiles, big banner + two small, flash deals, offer
--           band, category grid, two banners, popular deals, new/trending/sale
--           lists, recommended grid, newsletter.
-- Every text is editable in Admin › Homepage; nothing claims numbers the shop does not have.
begin;

alter table public.store_settings drop constraint if exists store_settings_home_theme_check;
alter table public.store_settings add constraint store_settings_home_theme_check
  check (home_theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market'));

alter table public.home_sections drop constraint if exists home_sections_theme_check;
alter table public.home_sections add constraint home_sections_theme_check
  check (theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market'));

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('chic', 'hero', 'Stylish Looks. Everyday You.', 'Trendy styles, premium quality and comfort you can feel — pay in cash when it arrives.', true, 10,
     '{"slides": [], "button": "Shop now", "link": "/products", "labels": {"eyebrow": "New collection", "button2": "Explore collections"}}'::jsonb),
  ('chic', 'benefits', null, null, true, 20, '{}'::jsonb),
  ('chic', 'category_tiles', 'Shop by Category', null, true, 30, '{"category_ids": [], "labels": {"view_all": "View all categories"}}'::jsonb),
  ('chic', 'product_row', 'New Arrivals', null, true, 40,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 8, "link": "/products?sort=new", "autoplay": false, "layout": "row", "labels": {"view_all": "View all products"}}'::jsonb),
  ('chic', 'banners', 'Limited time offer', null, true, 50,
     '{"items": [{"image": null, "title": "New styles every week", "subtitle": "Fresh arrivals in women''s fashion — cash on delivery all over Bangladesh.", "link": "/products?sort=new"}], "labels": {"button": "Grab the deal"}}'::jsonb),
  ('chic', 'product_row', 'All products', null, true, 60,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 20, "link": "/products", "autoplay": false, "layout": "grid"}'::jsonb),
  ('chic', 'benefits', null, null, true, 70,
     '{"labels": {"b1_title": "Exclusive offers", "b1_text": "New deals every week", "b2_title": "Safe payment", "b2_text": "Cash on delivery, bKash or Nagad", "b3_title": "Easy returns", "b4_title": "Here to help", "b4_text": "Call or WhatsApp us"}}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'chic');

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('market', 'category_tiles', null, null, true, 10, '{"category_ids": [], "labels": {"style": "mini"}}'::jsonb),
  ('market', 'hero', 'Fresh styles for every day', 'New arrivals every week — pay in cash when it arrives.', true, 20,
     '{"slides": [], "button": "Shop now", "link": "/products", "labels": {"eyebrow": "New"}}'::jsonb),
  ('market', 'deal', 'Flash Deals', null, true, 30,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 10, "eyebrow": "Today''s picks", "link": "/products", "ends_at": null}'::jsonb),
  ('market', 'banners', 'Shop the set', null, true, 40,
     '{"items": [{"image": null, "title": "Complete the look", "subtitle": "Mix and match sets — cash on delivery all over Bangladesh.", "link": "/products"}], "labels": {"button": "Shop now"}}'::jsonb),
  ('market', 'category_tiles', 'Shop By Category', null, true, 50, '{"category_ids": [], "labels": {"view_all": "View all"}}'::jsonb),
  ('market', 'banners', null, null, true, 60,
     '{"items": [{"image": null, "title": "New season styles", "subtitle": "Just arrived", "link": "/products?sort=new"}, {"image": null, "title": "Everyday comfort", "subtitle": "Soft fabrics", "link": "/products"}], "labels": {"button": "Shop now"}}'::jsonb),
  ('market', 'product_row', 'Popular deals', null, true, 70,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 10, "link": "/products", "autoplay": true, "layout": "row"}'::jsonb),
  ('market', 'product_row', null, null, true, 80,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 4, "link": "/products", "autoplay": false, "layout": "trio"}'::jsonb),
  ('market', 'product_row', 'Recommended for you', null, true, 90,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 20, "link": "/products", "autoplay": false, "layout": "grid"}'::jsonb),
  ('market', 'newsletter', 'Join our newsletter', 'New arrivals and offers in your inbox.', true, 100, '{}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'market');

commit;
