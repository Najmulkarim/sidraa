-- 0017 — Luxury home layout: two new section types (customer testimonials,
-- photo gallery), the default sections rearranged into the new order, and a
-- newsletter sign-up list.

-- ------------------------------------------------------ new section types
alter table public.home_sections drop constraint if exists home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check
  check (type in ('hero', 'quick_links', 'notice', 'benefits', 'category_tiles', 'collection', 'product_row', 'banners', 'about', 'testimonials', 'gallery'));

-- New layout, top to bottom: hero, benefit strip, signature-look circles,
-- "Most loved" auto-scrolling row, editorial banner, favourites + what
-- customers say, photo gallery. Earlier sections stay, switched off, so they
-- can be turned back on from Admin › Homepage.
update public.home_sections set sort_order = 10, title = coalesce(title, 'Elevate your everyday style') where type = 'hero';
update public.home_sections set sort_order = 20 where type = 'benefits';
update public.home_sections set sort_order = 30, title = 'Find your signature look', subtitle = 'Curated collections for every mood.' where type = 'category_tiles';
update public.home_sections set enabled = false, sort_order = 200 where type in ('quick_links', 'notice', 'about', 'collection');
update public.home_sections
   set sort_order = 40, title = 'Most loved this week', subtitle = 'Handpicked favourites from our customers.',
       settings = settings || '{"source": "featured", "limit": 12, "autoplay": true}'::jsonb
 where type = 'product_row';
update public.home_sections
   set sort_order = 50, title = 'Limited edition',
       settings = '{"items": [{"image": null, "title": "Timeless elegance, modern confidence", "subtitle": "Discover pieces designed to make every moment memorable.", "link": "/products?sort=new"}]}'::jsonb
 where type = 'banners';

insert into public.home_sections (type, title, subtitle, enabled, sort_order, settings)
select 'testimonials', 'What our customers say', null, true, 60,
       '{"items": [], "products_title": "Customer favourites", "source": "new", "limit": 4, "product_ids": [], "category_id": null}'::jsonb
 where not exists (select 1 from public.home_sections where type = 'testimonials');

insert into public.home_sections (type, title, subtitle, enabled, sort_order, settings)
select 'gallery', 'Follow our style', null, true, 70, '{"images": [], "handle": "", "handle_link": ""}'::jsonb
 where not exists (select 1 from public.home_sections where type = 'gallery');

-- ------------------------------------------------------------ newsletter
-- Written only by the server (service role) after a rate limit; staff with
-- the customers permission can read and remove entries.
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists newsletter_staff_read on public.newsletter_subscribers;
create policy newsletter_staff_read on public.newsletter_subscribers
  for select to authenticated using ((select public.has_permission('customers')));

drop policy if exists newsletter_staff_delete on public.newsletter_subscribers;
create policy newsletter_staff_delete on public.newsletter_subscribers
  for delete to authenticated using ((select public.has_permission('customers')));

revoke all on public.newsletter_subscribers from anon, authenticated;
grant select, delete on public.newsletter_subscribers to authenticated;
