-- 0030 — Product reviews. Safe to run again.
-- Customers review a product from a delivered order (checked by order number + phone);
-- the shop can also add reviews customers sent by message. Only approved reviews show.
-- products.rating_avg / rating_count are kept up to date from approved reviews.
begin;

create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  name        text not null check (char_length(name) between 2 and 60),
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 600),
  source      text not null default 'customer' check (source in ('customer', 'shop')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at  timestamptz not null default now()
);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, status);
create index if not exists product_reviews_status_idx on public.product_reviews (status, created_at desc);
-- One review per product per order.
create unique index if not exists product_reviews_order_product_key on public.product_reviews (order_id, product_id) where order_id is not null;

alter table public.products add column if not exists rating_avg numeric(3,2);
alter table public.products add column if not exists rating_count int not null default 0;

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := array_remove(array[
    case when tg_op in ('INSERT', 'UPDATE') then new.product_id end,
    case when tg_op in ('UPDATE', 'DELETE') then old.product_id end
  ], null);
begin
  update public.products p
     set rating_avg = r.avg, rating_count = coalesce(r.n, 0)
    from (
      select x.id, (select round(avg(rv.rating)::numeric, 2) from public.product_reviews rv where rv.product_id = x.id and rv.status = 'approved') as avg,
                   (select count(*)::int from public.product_reviews rv where rv.product_id = x.id and rv.status = 'approved') as n
        from unnest(ids) as x(id)
    ) r
   where p.id = r.id;
  return null;
end;
$$;

drop trigger if exists product_reviews_rating on public.product_reviews;
create trigger product_reviews_rating
  after insert or update or delete on public.product_reviews
  for each row execute function public.refresh_product_rating();

alter table public.product_reviews enable row level security;

drop policy if exists product_reviews_public_read on public.product_reviews;
create policy product_reviews_public_read on public.product_reviews
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists product_reviews_staff_all on public.product_reviews;
create policy product_reviews_staff_all on public.product_reviews
  for all to authenticated
  using (public.has_permission('catalog'))
  with check (public.has_permission('catalog'));

commit;
