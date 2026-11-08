-- Landing page templates: 'classic' (the first design) or 'showcase'
-- (hero, features, photo banners, feature grid, buy box, reviews, contact).
-- The showcase words and photos live in `sections`; the page fills gaps safely.
alter table public.landing_pages
  add column if not exists template text not null default 'classic' check (template in ('classic', 'showcase')),
  add column if not exists sections jsonb not null default '{}'::jsonb check (jsonb_typeof(sections) = 'object' and pg_column_size(sections) <= 60000);
