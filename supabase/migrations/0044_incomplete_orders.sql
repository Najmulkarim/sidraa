-- Incomplete orders: a customer typed a valid mobile number at checkout but
-- did not place the order. The checkout page saves what they entered (through
-- the server, never directly from the browser); staff can call them, then
-- turn it into an order, cancel it or delete it. Placing the order closes it.
create table if not exists public.incomplete_orders (
  id             uuid primary key default gen_random_uuid(),
  draft_key      uuid not null unique,
  customer_phone text not null check (customer_phone ~ '^01[3-9][0-9]{8}$'),
  customer_name  text check (char_length(customer_name) <= 120),
  address        text check (char_length(address) <= 500),
  district       text check (char_length(district) <= 80),
  area           text check (char_length(area) <= 80),
  note           text check (char_length(note) <= 500),
  zone_id        uuid references public.delivery_zones(id) on delete set null,
  -- [{ "variant_id": "…", "quantity": 1 }, …]
  items          jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30),
  status         text not null default 'open' check (status in ('open', 'converted', 'cancelled')),
  order_id       uuid references public.orders(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists incomplete_orders_status_idx on public.incomplete_orders (status, updated_at desc);
create index if not exists incomplete_orders_phone_idx on public.incomplete_orders (customer_phone, updated_at desc);

alter table public.incomplete_orders enable row level security;

-- Staff who handle orders can see and manage them; the website writes with the server key only.
drop policy if exists incomplete_orders_staff_read on public.incomplete_orders;
create policy incomplete_orders_staff_read on public.incomplete_orders
  for select to authenticated using ((select public.has_permission('orders')));
drop policy if exists incomplete_orders_staff_update on public.incomplete_orders;
create policy incomplete_orders_staff_update on public.incomplete_orders
  for update to authenticated using ((select public.has_permission('orders'))) with check ((select public.has_permission('orders')));
drop policy if exists incomplete_orders_staff_delete on public.incomplete_orders;
create policy incomplete_orders_staff_delete on public.incomplete_orders
  for delete to authenticated using ((select public.has_permission('orders')));

grant select, update, delete on public.incomplete_orders to authenticated;
