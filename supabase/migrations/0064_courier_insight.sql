-- 0064 — Courier tab in Accounting. Keeps the exact money a courier reports
-- for a parcel (what it collected, its COD fee) when its webhook sends them,
-- and a short log of webhook messages so the figures can be checked.
-- Safe to run again.

alter table public.orders add column if not exists courier_collected numeric(12,2);
alter table public.orders add column if not exists courier_cod_fee numeric(12,2);

create table if not exists public.courier_events (
  id bigint generated always as identity primary key,
  courier text not null,
  consignment_id text,
  event text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create index if not exists courier_events_received_idx on public.courier_events (received_at desc);
create index if not exists courier_events_consignment_idx on public.courier_events (courier, consignment_id);
-- Written by the webhooks (server key) only; staff read it through the server.
alter table public.courier_events enable row level security;
revoke all on public.courier_events from anon, authenticated;
