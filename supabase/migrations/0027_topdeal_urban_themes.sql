-- 0027 — Two more home themes. Safe to run again.
--   topdeal: navy deals store — big banner + six tiles, benefits, round categories,
--            then a left column (special items, tall offer, recommended) beside hot
--            deals, a banner, category product strip, recommended grid, benefits.
--   urban:   clean city look — full-width photo hero, new arrivals, photo category
--            tiles, sale banner, best sellers, trust badges, newsletter.
-- Every text is editable in Admin › Homepage; no ratings or numbers the shop does not have.
begin;

alter table public.store_settings drop constraint if exists store_settings_home_theme_check;
alter table public.store_settings add constraint store_settings_home_theme_check
  check (home_theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega', 'topdeal', 'urban'));

alter table public.home_sections drop constraint if exists home_sections_theme_check;
alter table public.home_sections add constraint home_sections_theme_check
  check (theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega', 'topdeal', 'urban'));

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('topdeal', 'hero', 'Top deals this week', 'Great prices on new styles — pay in cash when it arrives.', true, 10,
     '{"slides": [], "button": "Shop now", "link": "/products", "labels": {"eyebrow": "Super deal"}}'::jsonb),
  ('topdeal', 'benefits', null, null, true, 20, '{}'::jsonb),
  ('topdeal', 'category_tiles', null, null, true, 30, '{"category_ids": []}'::jsonb),
  ('topdeal', 'deal', 'Hot deal', null, true, 40,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 8, "eyebrow": "", "link": "/products", "ends_at": null}'::jsonb),
  ('topdeal', 'banners', 'Special offer', null, true, 50,
     '{"items": [{"image": null, "title": "New season styles", "subtitle": "Fresh arrivals every week — cash on delivery all over Bangladesh.", "link": "/products?sort=new"}], "labels": {"button": "Shop now"}}'::jsonb),
  ('topdeal', 'product_row', 'Fashion & accessories', null, true, 60,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 9, "link": "/products", "autoplay": true, "layout": "row"}'::jsonb),
  ('topdeal', 'product_row', 'Recommended for you', null, true, 70,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 20, "link": "/products", "autoplay": false, "layout": "grid"}'::jsonb),
  ('topdeal', 'benefits', null, null, true, 80,
     '{"labels": {"b1_title": "Top quality", "b1_text": "Checked before it ships", "b2_title": "Safe payment", "b2_text": "Cash on delivery, bKash or Nagad", "b3_title": "Easy returns", "b4_title": "Here to help", "b4_text": "Call or WhatsApp us"}}'::jsonb),
  ('topdeal', 'banners', 'Left column offer', null, true, 90,
     '{"items": [{"image": null, "title": "Today''s pick", "subtitle": "Shop the look", "link": "/products"}], "labels": {"place": "sidebar"}}'::jsonb),
  ('topdeal', 'newsletter', 'Subscribe to our newsletter', 'New arrivals and offers in your inbox.', true, 100, '{}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'topdeal');

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('urban', 'hero', 'Update your wardrobe. Shop the new collection.', null, true, 10,
     '{"slides": [], "button": "Shop now", "link": "/products", "labels": {"eyebrow": "New season", "button2": "New arrivals"}}'::jsonb),
  ('urban', 'product_row', 'New arrivals', null, true, 20,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 8, "link": "/products?sort=new", "autoplay": false, "layout": "grid"}'::jsonb),
  ('urban', 'category_tiles', 'Shop by category', null, true, 30, '{"category_ids": []}'::jsonb),
  ('urban', 'banners', null, null, true, 40,
     '{"items": [{"image": null, "title": "New styles every week", "subtitle": "Cash on delivery all over Bangladesh", "link": "/products?sort=new"}], "labels": {"button": "Shop now"}}'::jsonb),
  ('urban', 'product_row', 'Best sellers', null, true, 50,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 8, "link": "/products", "autoplay": false, "layout": "grid"}'::jsonb),
  ('urban', 'benefits', 'Why shop with us', null, true, 60, '{}'::jsonb),
  ('urban', 'newsletter', 'Stay connected', 'Sign up for new arrivals and offers.', true, 70, '{}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'urban');

commit;
