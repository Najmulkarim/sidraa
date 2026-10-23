-- 0004 — orders, order items (with snapshots), status history,
-- inventory movements and the rate-limit table.

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  public_ref       text not null unique,
  idempotency_key  uuid not null unique,
  status           public.order_status not null default 'pending',
  customer_name    text not null check (char_length(customer_name) between 2 and 80),
  customer_phone   text not null check (customer_phone ~ '^01[3-9][0-9]{8}$'),
  address          text not null check (char_length(address) between 5 and 300),
  district         text not null check (char_length(district) between 2 and 60),
  area             text check (char_length(area) <= 60),
  zone_id          uuid references public.delivery_zones (id) on delete set null,
  zone_name        text not null,
  note             text check (char_length(note) <= 500),
  subtotal         numeric(12,2) not null check (subtotal >= 0),
  discount         numeric(12,2) not null default 0 check (discount >= 0),
  delivery_charge  numeric(12,2) not null check (delivery_charge >= 0),
  total            numeric(12,2) not null check (total >= 0),
  payment_method   text not null default 'cod' check (payment_method = 'cod'),
  stock_released   boolean not null default false,
  ip_hash          text,
  confirmed_at     timestamptz,
  processing_at    timestamptz,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  returned_at      timestamptz,
  redacted_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_total_chk check (total = subtotal - discount + delivery_charge)
);
create index orders_created_idx        on public.orders (created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_phone_idx          on public.orders (customer_phone);
create index orders_delivered_idx      on public.orders (delivered_at) where status = 'delivered';
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  product_name  text not null,
  sku           text not null,
  variant_label text not null default '',
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      int not null check (quantity between 1 and 20),
  line_total    numeric(12,2) not null,
  created_at    timestamptz not null default now(),
  constraint order_items_line_total_chk check (line_total = unit_price * quantity)
);
create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references auth.users (id) on delete set null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.inventory_movements (
  id         bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  change     int not null check (change <> 0),
  reason     public.movement_reason not null,
  order_id   uuid references public.orders (id) on delete set null,
  note       text check (char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);
