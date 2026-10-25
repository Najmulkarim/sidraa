-- 0026 — Seventh home theme "Mega": dark header, category sidebar (with a
-- tall offer banner, latest products and service points), big + two small
-- banners, a gift ribbon, daily deals, a wide badge banner, trending grid,
-- new arrivals and a newsletter. Safe to run again.
begin;

alter table public.store_settings drop constraint if exists store_settings_home_theme_check;
alter table public.store_settings add constraint store_settings_home_theme_check
  check (home_theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega'));

alter table public.home_sections drop constraint if exists home_sections_theme_check;
alter table public.home_sections add constraint home_sections_theme_check
  check (theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega'));

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('mega', 'hero', 'Fresh styles for every day', 'New arrivals every week — pay in cash when it arrives.', true, 10,
     '{"slides": [], "button": "Shop now", "link": "/products", "labels": {"eyebrow": "New"}}'::jsonb),
  ('mega', 'notice', 'Gift special', 'New offers every week — cash on delivery all over Bangladesh.', true, 20,
     '{"link": "/products", "link_label": "Shop now"}'::jsonb),
  ('mega', 'deal', 'Daily deals', null, true, 30,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 6, "eyebrow": "", "link": "/products", "ends_at": null}'::jsonb),
  ('mega', 'banners', 'Special offer', null, true, 40,
     '{"items": [{"image": null, "title": "Complete the look", "subtitle": "Mix and match sets — cash on delivery all over Bangladesh.", "link": "/products"}], "labels": {"button": "Shop now"}}'::jsonb),
  ('mega', 'product_row', 'Trending items', null, true, 50,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 10, "link": "/products", "autoplay": false, "layout": "grid"}'::jsonb),
  ('mega', 'product_row', 'New arrivals', null, true, 60,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 10, "link": "/products?sort=new", "autoplay": true, "layout": "row"}'::jsonb),
  ('mega', 'banners', 'Left column offer', null, true, 70,
     '{"items": [{"image": null, "title": "New season", "subtitle": "Just arrived", "link": "/products?sort=new"}], "labels": {"place": "sidebar"}}'::jsonb),
  ('mega', 'newsletter', 'Join our newsletter', 'New arrivals and offers in your inbox.', true, 80, '{}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'mega');

commit;
