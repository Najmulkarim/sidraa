-- 0001 — extensions, enum types and the shared updated_at trigger.
-- Supabase already installs pgcrypto in the "extensions" schema; the
-- statements are idempotent so a fresh project and a local stack agree.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

create type public.order_status as enum (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'
);

create type public.product_status as enum ('draft', 'published', 'archived');

-- super_admin: everything, including staff and roles. manager / support:
-- what role_permissions grants them (0003).
create type public.admin_role as enum ('super_admin', 'manager', 'support');

-- edit: stock taken or given back when staff change an order's items.
create type public.movement_reason as enum ('order', 'cancel', 'return', 'restock', 'adjust', 'edit');

-- Keeps updated_at honest on every mutable table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
