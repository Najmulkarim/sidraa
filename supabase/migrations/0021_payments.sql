-- Online payment at checkout: bKash or Nagad, either manual (customer sends
-- money to the shop's number and types the Transaction ID; staff verify it)
-- or merchant (payment gateway confirms it automatically).

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('cod', 'bkash', 'nagad')),
  add column if not exists payment_mode text check (payment_mode in ('manual', 'merchant')),
  -- none: cash on delivery. pending: waiting for the gateway or for staff to check the TrxID.
  add column if not exists payment_status text not null default 'none' check (payment_status in ('none', 'pending', 'paid', 'failed')),
  add column if not exists payment_sender text check (char_length(payment_sender) <= 20),
  add column if not exists payment_trx_id text check (char_length(payment_trx_id) <= 40),
  add column if not exists payment_gateway_id text check (char_length(payment_gateway_id) <= 120);

-- One Transaction ID pays for one order only.
create unique index if not exists orders_payment_trx_unique
  on public.orders (payment_method, upper(payment_trx_id)) where payment_trx_id is not null;
create index if not exists orders_payment_gateway_idx on public.orders (payment_gateway_id) where payment_gateway_id is not null;

-- Payment settings. Holds gateway secrets, so only the server (service role) reads or writes it;
-- the admin page goes through a server action that checks the store_settings permission.
create table if not exists public.payment_settings (
  id                int primary key default 1 check (id = 1),
  cod_enabled       boolean not null default true,
  bkash_manual      boolean not null default false,
  bkash_number      text check (char_length(bkash_number) <= 20),
  bkash_number_type text not null default 'personal' check (bkash_number_type in ('personal', 'agent', 'merchant')),
  nagad_manual      boolean not null default false,
  nagad_number      text check (char_length(nagad_number) <= 20),
  nagad_number_type text not null default 'personal' check (nagad_number_type in ('personal', 'agent', 'merchant')),
  bkash_merchant    boolean not null default false,
  bkash_sandbox     boolean not null default true,
  bkash_app_key     text check (char_length(bkash_app_key) <= 300),
  bkash_app_secret  text check (char_length(bkash_app_secret) <= 300),
  bkash_username    text check (char_length(bkash_username) <= 300),
  bkash_password    text check (char_length(bkash_password) <= 300),
  nagad_merchant    boolean not null default false,
  nagad_sandbox     boolean not null default true,
  nagad_merchant_id text check (char_length(nagad_merchant_id) <= 100),
  nagad_public_key  text check (char_length(nagad_public_key) <= 4000),
  nagad_private_key text check (char_length(nagad_private_key) <= 4000),
  updated_at        timestamptz not null default now()
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists payment_settings_updated_at on public.payment_settings;
create trigger payment_settings_updated_at before update on public.payment_settings for each row execute function public.set_updated_at();
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public, anon, authenticated;
