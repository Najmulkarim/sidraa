-- Product tags (like Shopify): staff give products tags such as "Eid Sale" or
-- "Best seller"; every tag becomes a collection the website can show
-- (/collections/eid-sale, home page sections, …).
alter table public.products
  add column if not exists tags text[] not null default '{}';

alter table public.products drop constraint if exists products_tags_max;
alter table public.products add constraint products_tags_max check (cardinality(tags) <= 20);

create index if not exists products_tags_idx on public.products using gin (tags);
