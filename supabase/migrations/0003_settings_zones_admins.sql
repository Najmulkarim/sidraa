-- 0003 — store settings (single row), delivery zones, admin profiles,
-- and the is_admin() / is_owner() helpers every policy uses.

create table public.store_settings (
  id                  smallint primary key default 1 check (id = 1),
  store_name          text not null default 'Your Store' check (char_length(store_name) between 1 and 80),
  tagline             text check (char_length(tagline) <= 120),
  logo_path           text,
  theme               jsonb not null default '{}'::jsonb,
  phone               text check (char_length(phone) <= 30),
  email               text check (char_length(email) <= 120),
  address             text check (char_length(address) <= 300),
  social              jsonb not null default '{}'::jsonb,
  cod_terms           text not null default 'Pay the rider in cash when your parcel arrives. You may check the items before paying.'
                        check (char_length(cod_terms) <= 2000),
  return_policy_days  int  not null default 3 check (return_policy_days between 0 and 60),
  order_ref_prefix    text not null default 'SD' check (order_ref_prefix ~ '^[A-Z]{2,4}$'),
  low_stock_threshold int  not null default 3 check (low_stock_threshold between 0 and 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

create table public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  charge     numeric(12,2) not null check (charge >= 0),
  free_over  numeric(12,2) check (free_over is null or free_over > 0),
  eta_text   text check (char_length(eta_text) <= 60),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_zones_updated_at before update on public.delivery_zones for each row execute function public.set_updated_at();

create table public.admin_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(full_name) between 1 and 80),
  role       public.admin_role not null default 'support',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_profiles_updated_at before update on public.admin_profiles for each row execute function public.set_updated_at();

-- Two-factor: once a user has a verified TOTP factor, their session must
-- be aal2 (password + code) before they count as an admin. Users without
-- a factor pass, so the first sign-in can enrol one.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

-- security definer so policies can call them without recursing into
-- admin_profiles' own RLS. auth.uid() is wrapped in a sub-select so the
-- planner evaluates it once per statement.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = (select auth.uid()) and is_active
  )
  and public.mfa_satisfied();
$$;

-- Super admin (the shop owner). Kept under the old name is_owner() because
-- many policies read better with it.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = (select auth.uid()) and is_active and role = 'super_admin'
  )
  and public.mfa_satisfied();
$$;

-- ------------------------------------------------- roles and permissions
-- What each permission unlocks (checked in RLS policies and functions):
--   dashboard        dashboard numbers
--   revenue          sales amounts, reports, CSV of products
--   orders           view orders, change status, notes, assign, payments, edit customer
--   orders_edit      change items, prices, delivery charge and discount; manual orders
--   orders_delete    delete / restore orders
--   orders_export    orders CSV
--   courier          send parcels to the courier, refresh courier status
--   catalog          products, categories, photos, coupons
--   inventory        restock and stock adjustments
--   customers        customer list and block list
--   marketing        Facebook Pixel, Conversions API, catalog feed settings
--   courier_settings courier API keys and options
--   store_settings   brand, contact, delivery charges, checkout options
-- Super admins have all of them plus staff and role management.
create table public.permissions (
  key   text primary key,
  label text not null,
  sort  int  not null
);
insert into public.permissions (key, label, sort) values
  ('dashboard', 'View dashboard', 1),
  ('revenue', 'See sales amounts and reports', 2),
  ('orders', 'View orders, change status, notes, assign, payments', 3),
  ('orders_edit', 'Edit order items, prices, delivery and discount; add manual orders', 4),
  ('orders_delete', 'Delete and restore orders', 5),
  ('orders_export', 'Download orders CSV', 6),
  ('courier', 'Send parcels to the courier', 7),
  ('catalog', 'Products, categories, photos and coupons', 8),
  ('inventory', 'Restock and adjust stock', 9),
  ('customers', 'Customers and block list', 10),
  ('marketing', 'Facebook Pixel, Conversions API and catalog', 11),
  ('courier_settings', 'Courier API keys and options', 12),
  ('store_settings', 'Store settings and delivery charges', 13);

create table public.role_permissions (
  role       public.admin_role not null check (role <> 'super_admin'),
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);
insert into public.role_permissions (role, permission)
select 'manager'::public.admin_role, key from public.permissions
 where key in ('dashboard', 'revenue', 'orders', 'orders_edit', 'orders_delete', 'orders_export', 'courier', 'catalog', 'inventory', 'customers')
union all
select 'support'::public.admin_role, key from public.permissions
 where key in ('dashboard', 'orders', 'courier', 'customers');

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
-- Any admin may read the matrix (the UI shows it); changes go through
-- set_role_permissions() in 0011, which only a super admin may call.

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mfa_satisfied() and exists (
    select 1 from public.admin_profiles a
     where a.user_id = (select auth.uid()) and a.is_active
       and (a.role = 'super_admin'
            or exists (select 1 from public.role_permissions rp where rp.role = a.role and rp.permission = p_permission))
  );
$$;

-- Raises FORBIDDEN unless the caller has the permission. Used at the top of functions.
create or replace function public.require_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_permission) then
    raise exception using message = 'FORBIDDEN', detail = jsonb_build_object('permission', p_permission)::text;
  end if;
end;
$$;

-- The signed-in admin's role and permission list, for the admin UI.
create or replace function public.my_permissions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'role', a.role,
    'permissions', case when a.role = 'super_admin'
                        then (select jsonb_agg(key order by sort) from public.permissions) || '["staff"]'::jsonb
                        else coalesce((select jsonb_agg(rp.permission) from public.role_permissions rp where rp.role = a.role), '[]'::jsonb) end)
  end
  from public.admin_profiles a where a.user_id = (select auth.uid());
$$;
