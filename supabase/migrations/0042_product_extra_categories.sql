-- A product can show in more than one category.
-- category_id stays the main category (breadcrumbs, Google, Facebook catalogue);
-- extra_category_ids lists the other categories it also shows in.
alter table public.products
  add column if not exists extra_category_ids uuid[] not null default '{}';

-- Category pages look products up by either column.
create index if not exists products_extra_category_ids_idx on public.products using gin (extra_category_ids);
