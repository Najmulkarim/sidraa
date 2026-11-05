-- Collections (like Shopify): a named group of products shown on its own page
-- (/collections/<slug>) and in home page sections. Products join a collection
-- by rules (tag, category, name, SKU, price) and/or by being picked by hand.
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (char_length(description) <= 2000),
  is_public   boolean not null default true,
  -- 'any': a product matching any rule is in; 'all': it must match every rule.
  match       text not null default 'any' check (match in ('any', 'all')),
  -- [{ "field": "tag", "op": "is", "value": "Eid Sale" }, …]
  rules       jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) <= 20),
  -- Products picked by hand: always in the collection.
  product_ids uuid[] not null default '{}' check (cardinality(product_ids) <= 200),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;

drop policy if exists collections_public_read on public.collections;
create policy collections_public_read on public.collections
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));
drop policy if exists collections_admin_insert on public.collections;
create policy collections_admin_insert on public.collections
  for insert to authenticated with check ((select public.has_permission('catalog')));
drop policy if exists collections_admin_update on public.collections;
create policy collections_admin_update on public.collections
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
drop policy if exists collections_admin_delete on public.collections;
create policy collections_admin_delete on public.collections
  for delete to authenticated using ((select public.has_permission('catalog')));

grant select on public.collections to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
