-- 0028 — "Nova" home theme. Safe to run again.
--   nova: navy and orange editorial store — full-width photo hero with a highlighted
--         word, category circles beside a heading, two split banners, favourites with
--         tabs, new arrivals grid, "complete the look", a story band, benefits,
--         customer comments (only real ones), style gallery, style links, newsletter.
-- Every text is editable in Admin › Homepage; no ratings or numbers the shop does not have.
begin;

alter table public.store_settings drop constraint if exists store_settings_home_theme_check;
alter table public.store_settings add constraint store_settings_home_theme_check
  check (home_theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega', 'topdeal', 'urban', 'nova'));

alter table public.home_sections drop constraint if exists home_sections_theme_check;
alter table public.home_sections add constraint home_sections_theme_check
  check (theme in ('luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega', 'topdeal', 'urban', 'nova'));

insert into public.home_sections (theme, type, title, subtitle, enabled, sort_order, settings)
select * from (values
  ('nova', 'hero', 'A season styled for you', 'Soft layers, bold colour and timeless pieces — cash on delivery all over Bangladesh.', true, 10,
     '{"slides": [], "button": "Shop new season", "link": "/products?sort=new", "labels": {"eyebrow": "New collection", "highlight": "for you", "script": "Style that feels like you"}}'::jsonb),
  ('nova', 'category_tiles', 'Find your style', null, true, 20,
     '{"category_ids": [], "labels": {"eyebrow": "Shop by category", "view_all": "View all categories"}}'::jsonb),
  ('nova', 'banners', null, null, true, 30,
     '{"items": [{"image": null, "title": "Effortless layers", "subtitle": "Easy pieces for everyday moments.", "link": "/products"}, {"image": null, "title": "Warm feels, bolder days", "subtitle": "Soft textures, rich colours. Made for the season.", "link": "/products?sort=new"}], "labels": {"eyebrow1": "The new edit", "eyebrow2": "Just in", "button1": "Shop now", "button2": "Shop new in"}}'::jsonb),
  ('nova', 'product_row', 'Our favourites', null, true, 40,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 12, "link": "/products", "autoplay": false, "layout": "row", "labels": {"eyebrow": "Featured products", "tab1": "Best sellers", "tab2": "New in", "tab3": "Special price"}}'::jsonb),
  ('nova', 'product_row', 'Fresh pieces for brighter days', null, true, 50,
     '{"source": "new", "category_id": null, "product_ids": [], "limit": 6, "link": "/products?sort=new", "autoplay": false, "layout": "grid", "labels": {"eyebrow": "New arrivals", "badge": "New", "view_all": "View all"}}'::jsonb),
  ('nova', 'collection', 'Complete the look', 'Pieces that go together, picked for you.', true, 60,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 5, "image": null, "link": "/products", "labels": {"eyebrow": "Shop the look", "button": "Explore looks"}}'::jsonb),
  ('nova', 'about', 'Real people, brighter stories', 'Style is not just what you wear — it is how you feel. We pick every piece for real days and real people, and you pay only when it reaches you.', true, 70,
     '{"image": null, "link": "/products", "link_label": "Discover the shop", "labels": {"eyebrow": "More than fashion", "script": "Fashion · People · Possibilities"}}'::jsonb),
  ('nova', 'benefits', null, null, true, 80, '{}'::jsonb),
  ('nova', 'testimonials', 'Real people, real stories', null, true, 90,
     '{"source": "featured", "category_id": null, "product_ids": [], "limit": 4, "products_title": "", "items": [], "labels": {"eyebrow": "Customer love"}}'::jsonb),
  ('nova', 'gallery', 'Style gallery', null, true, 100,
     '{"images": [], "handle": "", "handle_link": "", "labels": {"eyebrow": "Our looks", "view_all": "View gallery"}}'::jsonb),
  ('nova', 'banners', 'Style & inspiration', null, true, 110,
     '{"items": [{"image": null, "title": "Fresh arrivals this week", "subtitle": "", "link": "/products?sort=new"}, {"image": null, "title": "Most loved by our customers", "subtitle": "", "link": "/products"}, {"image": null, "title": "Great styles at smart prices", "subtitle": "", "link": "/products?sort=price-asc"}], "labels": {"eyebrow1": "New in", "eyebrow2": "Popular", "eyebrow3": "Smart buys", "button": "Shop now", "eyebrow": "The style journal"}}'::jsonb),
  ('nova', 'newsletter', 'Join the insider list', 'Be the first to hear about new arrivals and offers.', true, 120, '{}'::jsonb)
) as v(theme, type, title, subtitle, enabled, sort_order, settings)
where not exists (select 1 from public.home_sections h where h.theme = 'nova');

commit;
