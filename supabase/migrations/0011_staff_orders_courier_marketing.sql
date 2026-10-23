-- 0011 — what a live shop needs beyond the basics:
--   * staff management and the editable role → permission matrix (super admin)
--   * full order editing and manual (phone / Facebook) orders
--   * coupons and a block list for fake buyers
--   * customers list
--   * courier booking (Steadfast, Pathao) and status sync
--   * Facebook Pixel / Conversions API settings and an event log
--
-- Secrets (courier keys, the Conversions API token) live in tables with RLS
-- on and no policies: browsers can never select them. Admins with the right
-- permission read masked values through functions; the server reads the
-- real values with the service role only after checking the permission.

-- ------------------------------------------------------------ order fields
alter table public.orders
  add column source      text not null default 'website'
    check (source in ('website', 'phone', 'facebook', 'whatsapp', 'instagram', 'other')),
  add column coupon_code text,
  add column created_by  uuid references auth.users (id) on delete set null,
  -- courier
  add column courier                text check (courier in ('steadfast', 'pathao')),
  add column courier_consignment_id text,
  add column courier_tracking_code  text,
  add column courier_status         text,
  add column courier_charge         numeric(12,2),
  add column courier_sent_at        timestamptz,
  add column courier_synced_at      timestamptz,
  add column courier_lock_at        timestamptz,
  add column courier_error          text check (char_length(courier_error) <= 500);

create unique index orders_courier_consignment_idx on public.orders (courier, courier_consignment_id)
  where courier_consignment_id is not null;
create index orders_courier_sync_idx on public.orders (courier_synced_at nulls first)
  where status = 'shipped' and courier_consignment_id is not null;

alter table public.store_settings
  add column fb_pixel_id     text check (fb_pixel_id ~ '^[0-9]{6,20}$'),
  add column announcement    text check (char_length(announcement) <= 160),
  add column coupons_enabled boolean not null default true;

-- ----------------------------------------------------------------- coupons
create table public.coupons (
  code          text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind          text not null check (kind in ('percent', 'fixed')),
  value         numeric(12,2) not null check (value > 0),
  min_subtotal  numeric(12,2) not null default 0 check (min_subtotal >= 0),
  max_discount  numeric(12,2) check (max_discount is null or max_discount > 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  usage_limit   int check (usage_limit is null or usage_limit > 0),
  used_count    int not null default 0 check (used_count >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint coupons_percent_chk check (kind <> 'percent' or value <= 90),
  constraint coupons_dates_chk check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;
revoke all on public.coupons from anon;
grant select, insert, update, delete on public.coupons to authenticated;
create policy coupons_admin_read on public.coupons
  for select to authenticated using ((select public.has_permission('catalog')));
create policy coupons_admin_insert on public.coupons
  for insert to authenticated with check ((select public.has_permission('catalog')) and used_count = 0);
create policy coupons_admin_update on public.coupons
  for update to authenticated using ((select public.has_permission('catalog'))) with check ((select public.has_permission('catalog')));
create policy coupons_admin_delete on public.coupons
  for delete to authenticated using ((select public.has_permission('catalog')));

-- Discount for a subtotal, or the reason the code does not apply.
-- p_lock = true locks the coupon row (place_order); quotes do not lock.
create or replace function public.coupon_discount(p_code text, p_subtotal numeric, p_lock boolean)
returns table (code text, discount numeric, error text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  c public.coupons%rowtype;
  d numeric(12,2);
begin
  if not coalesce((select s.coupons_enabled from public.store_settings s where s.id = 1), true) then
    return query select v_code, 0::numeric, 'Coupons are not available right now';
    return;
  end if;
  if p_lock then
    select * into c from public.coupons x where x.code = v_code for update;
  else
    select * into c from public.coupons x where x.code = v_code;
  end if;
  if c.code is null or not c.is_active then
    return query select v_code, 0::numeric, 'This code is not valid';
  elsif c.starts_at is not null and now() < c.starts_at then
    return query select c.code, 0::numeric, 'This code is not active yet';
  elsif c.ends_at is not null and now() >= c.ends_at then
    return query select c.code, 0::numeric, 'This code has expired';
  elsif c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select c.code, 0::numeric, 'This code has been used up';
  elsif p_subtotal < c.min_subtotal then
    return query select c.code, 0::numeric, 'Add items worth ৳' || to_char(c.min_subtotal, 'FM999999990') || ' or more to use this code';
  else
    d := case when c.kind = 'percent' then round(p_subtotal * c.value / 100) else c.value end;
    d := least(d, coalesce(c.max_discount, d), p_subtotal);
    return query select c.code, d, null::text;
  end if;
end;
$$;

-- ------------------------------------------------------------ block list
create table public.blocked_phones (
  phone      text primary key check (phone ~ '^01[3-9][0-9]{8}$'),
  reason     text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.blocked_phones enable row level security;
revoke all on public.blocked_phones from anon;
grant select on public.blocked_phones to authenticated;
create policy blocked_phones_admin_read on public.blocked_phones
  for select to authenticated using ((select public.has_permission('customers')) or (select public.has_permission('orders')));

create or replace function public.block_phone(p_phone text, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_bd_phone(p_phone);
begin
  perform public.require_permission('customers');
  if v_phone is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'phone', 'reason', 'Enter a valid Bangladeshi mobile number')::text;
  end if;
  insert into public.blocked_phones (phone, reason, created_by)
  values (v_phone, nullif(left(btrim(coalesce(p_reason, '')), 200), ''), auth.uid())
  on conflict (phone) do update set reason = excluded.reason;
end;
$$;

create or replace function public.unblock_phone(p_phone text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('customers');
  delete from public.blocked_phones where phone = public.normalize_bd_phone(p_phone);
end;
$$;

-- --------------------------------------------------------------- customers
-- One row per phone number, from orders (deleted orders excluded).
create or replace function public.customers_list(p_q text default null, p_filter text default 'all', p_limit int default 50, p_offset int default 0)
returns table (
  phone text, name text, district text, orders int, delivered int, returned int, cancelled int,
  spent numeric, last_order_at timestamptz, blocked boolean, block_reason text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.require_permission('customers');
  return query
  with c as (
    select o.customer_phone as phone,
           (array_agg(o.customer_name order by o.created_at desc))[1] as name,
           (array_agg(o.district order by o.created_at desc))[1] as district,
           count(*)::int as orders,
           count(*) filter (where o.status = 'delivered')::int as delivered,
           count(*) filter (where o.status in ('returned', 'lost'))::int as returned,
           count(*) filter (where o.status in ('cancelled', 'fake'))::int as cancelled,
           coalesce(sum(o.total) filter (where o.status = 'delivered'), 0) as spent,
           max(o.created_at) as last_order_at
      from public.orders o
     where o.deleted_at is null and o.redacted_at is null
     group by o.customer_phone
  ), j as (
    select c.*, (b.phone is not null) as blocked, b.reason as block_reason
      from c left join public.blocked_phones b on b.phone = c.phone
     where (v_q is null or c.phone like '%' || regexp_replace(v_q, '\D', '', 'g') || '%' and regexp_replace(v_q, '\D', '', 'g') <> ''
            or c.name ilike '%' || v_q || '%')
       and (p_filter = 'all'
            or (p_filter = 'blocked' and b.phone is not null)
            or (p_filter = 'repeat' and c.orders > 1)
            or (p_filter = 'risky' and c.returned + c.cancelled > 0 and c.returned + c.cancelled >= c.delivered))
  )
  select j.phone, j.name, j.district, j.orders, j.delivered, j.returned, j.cancelled, j.spent,
         j.last_order_at, j.blocked, j.block_reason, count(*) over ()
    from j
   order by j.last_order_at desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- ------------------------------------------------------------------- staff
-- Super admin only. Accounts are created in Supabase Auth by the server
-- (service role) after it has checked is_owner(); this function then gives
-- the account its profile and role.
create or replace function public.staff_list()
returns table (user_id uuid, email text, full_name text, role public.admin_role, is_active boolean, mfa boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception using message = 'FORBIDDEN';
  end if;
  return query
  select a.user_id, u.email::text, a.full_name, a.role, a.is_active,
         exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified'),
         a.created_at
    from public.admin_profiles a
    join auth.users u on u.id = a.user_id
   order by a.role, a.full_name;
end;
$$;

create or replace function public.save_staff(p_user_id uuid, p_full_name text, p_role public.admin_role, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not public.is_owner() then
    raise exception using message = 'FORBIDDEN';
  end if;
  if char_length(v_name) not between 1 and 80 or p_role is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'full_name', 'reason', 'Enter a name and a role')::text;
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception using message = 'NOT_FOUND';
  end if;
  -- Never lock the shop out: you cannot demote or switch off yourself.
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or not p_active) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'role', 'reason', 'You cannot remove your own super admin access')::text;
  end if;
  insert into public.admin_profiles (user_id, full_name, role, is_active)
  values (p_user_id, v_name, p_role, coalesce(p_active, true))
  on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;
  -- Unassign open orders from someone switched off.
  if not coalesce(p_active, true) then
    update public.orders set assigned_to = null
     where assigned_to = p_user_id and status in ('pending', 'confirmed', 'processing', 'hold', 'ship_later');
  end if;
end;
$$;

create or replace function public.set_role_permissions(p_role public.admin_role, p_permissions text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception using message = 'FORBIDDEN';
  end if;
  if p_role = 'super_admin' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'role', 'reason', 'Super admins always have every permission')::text;
  end if;
  if exists (select 1 from unnest(coalesce(p_permissions, '{}')) x where x not in (select key from public.permissions)) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'permissions', 'reason', 'Unknown permission')::text;
  end if;
  delete from public.role_permissions where role = p_role;
  insert into public.role_permissions (role, permission)
  select distinct p_role, x from unnest(coalesce(p_permissions, '{}')) x;
end;
$$;

-- ---------------------------------------------- full order edit / manual order
-- p_order_id null → a new manual order (phone, Facebook…). Otherwise the
-- order's items, prices, delivery charge, discount and customer details are
-- replaced while it is still open. Stock follows the change: only the
-- difference per variant is taken or given back, and every unit is logged.
--
-- payload: { idempotency_key (new only), customer_name, customer_phone,
--   address, district, area, note, zone_id, delivery_charge (optional
--   override), discount, source, status ('pending'|'confirmed', new only),
--   items: [{variant_id, quantity, unit_price (optional override)}] }
create or replace function public.admin_save_order(p_order_id uuid, p_payload jsonb)
returns table (order_id uuid, public_ref text, total numeric)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order     public.orders%rowtype;
  v_new       boolean := p_order_id is null;
  v_key       uuid;
  v_name      text := btrim(coalesce(p_payload->>'customer_name', ''));
  v_phone     text := public.normalize_bd_phone(p_payload->>'customer_phone');
  v_address   text := btrim(coalesce(p_payload->>'address', ''));
  v_district  text := btrim(coalesce(p_payload->>'district', ''));
  v_area      text := nullif(btrim(coalesce(p_payload->>'area', '')), '');
  v_note      text := nullif(btrim(coalesce(p_payload->>'note', '')), '');
  v_source    text := coalesce(nullif(p_payload->>'source', ''), case when p_order_id is null then 'phone' else null end);
  v_zone      public.delivery_zones%rowtype;
  v_items     jsonb := p_payload->'items';
  v_bad       int;
  v_problems  jsonb;
  v_subtotal  numeric(12,2);
  v_discount  numeric(12,2);
  v_delivery  numeric(12,2);
  v_total     numeric(12,2);
  v_prefix    text;
  v_ref       text;
  v_id        uuid;
  v_before    text;
begin
  perform public.require_permission('orders_edit');

  -- Customer fields
  if char_length(v_name) not between 2 and 80 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'customer_name', 'reason', 'Enter the customer name')::text;
  end if;
  if v_phone is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'customer_phone', 'reason', 'Enter a valid Bangladeshi mobile number')::text;
  end if;
  if char_length(v_address) not between 5 and 300 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'address', 'reason', 'Enter the full address')::text;
  end if;
  if char_length(v_district) not between 2 and 60 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'district', 'reason', 'Enter the district')::text;
  end if;
  if char_length(coalesce(v_area, '')) > 60 or char_length(coalesce(v_note, '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Too long')::text;
  end if;
  if v_source is not null and v_source not in ('website', 'phone', 'facebook', 'whatsapp', 'instagram', 'other') then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'source', 'reason', 'Unknown order source')::text;
  end if;

  -- Items: 1–30 lines, quantity 1–99, optional unit price 0–1,000,000.
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 30 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'Add 1 to 30 items')::text;
  end if;
  select count(*) into v_bad from jsonb_array_elements(v_items) e
   where jsonb_typeof(e) <> 'object'
      or coalesce(e->>'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(e->>'quantity', '') !~ '^[0-9]{1,2}$' or (e->>'quantity')::int < 1
      or (e ? 'unit_price' and jsonb_typeof(e->'unit_price') <> 'null'
          and (jsonb_typeof(e->'unit_price') <> 'number' or (e->>'unit_price')::numeric < 0
               or (e->>'unit_price')::numeric > 1000000 or round((e->>'unit_price')::numeric, 2) <> (e->>'unit_price')::numeric));
  if v_bad > 0 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'Each item needs a product size, a quantity from 1 to 99 and a valid price')::text;
  end if;

  -- Zone
  begin
    select * into v_zone from public.delivery_zones where id = (p_payload->>'zone_id')::uuid;
  exception when invalid_text_representation then
    null;
  end;
  if v_zone.id is null then
    raise exception using message = 'ZONE_INVALID', detail = jsonb_build_object('field', 'zone_id', 'reason', 'Choose a delivery area')::text;
  end if;

  if v_new then
    begin
      v_key := (p_payload->>'idempotency_key')::uuid;
    exception when others then
      v_key := null;
    end;
    if v_key is null then
      raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'idempotency_key', 'reason', 'Missing or invalid')::text;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
    select * into v_order from public.orders o where o.idempotency_key = v_key;
    if found then
      return query select v_order.id, v_order.public_ref, v_order.total;
      return;
    end if;
  else
    select * into v_order from public.orders o where o.id = p_order_id for update;
    if not found or v_order.deleted_at is not null then
      raise exception using message = 'NOT_FOUND';
    end if;
    if v_order.status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') or v_order.courier_consignment_id is not null then
      raise exception using message = 'BAD_TRANSITION', detail = jsonb_build_object('from', v_order.status, 'to', 'edit')::text;
    end if;
    select string_agg(oi.product_name || coalesce(' (' || nullif(oi.variant_label, '') || ')', '') || ' ×' || oi.quantity, ', ' order by oi.created_at)
      into v_before from public.order_items oi where oi.order_id = p_order_id;
  end if;

  -- Merge duplicate variants (the first price given wins).
  drop table if exists pg_temp.t_new_items;
  create temp table t_new_items (variant_id uuid primary key, quantity int, unit_price numeric) on commit drop;
  insert into pg_temp.t_new_items (variant_id, quantity, unit_price)
  select (e->>'variant_id')::uuid, sum((e->>'quantity')::int),
         (array_agg(case when jsonb_typeof(e->'unit_price') = 'number' then (e->>'unit_price')::numeric end order by ord))[1]
    from jsonb_array_elements(v_items) with ordinality as x(e, ord)
   group by 1;
  if exists (select 1 from pg_temp.t_new_items where quantity > 99) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'At most 99 of one item')::text;
  end if;

  -- Lock every variant involved (old and new) in id order.
  perform 1 from public.product_variants v
   where v.id in (select n.variant_id from pg_temp.t_new_items n
                  union select oi.variant_id from public.order_items oi where oi.order_id = p_order_id and oi.variant_id is not null)
   order by v.id for update;

  -- Stock check on the difference only: units already in this order count as available.
  select jsonb_agg(jsonb_build_object(
           'variant_id', n.variant_id, 'product_name', p.name,
           'variant_label', public.variant_label(v.color, v.size, v.option3),
           'requested', n.quantity, 'available', coalesce(v.stock, 0) + coalesce(old.qty, 0)))
    into v_problems
    from pg_temp.t_new_items n
    left join public.product_variants v on v.id = n.variant_id
    left join public.products p on p.id = v.product_id
    left join (select oi.variant_id, sum(oi.quantity)::int as qty from public.order_items oi
                where oi.order_id = p_order_id group by oi.variant_id) old on old.variant_id = n.variant_id
   where v.id is null
      or (old.qty is null and (not v.is_active or p.status = 'archived'))
      or v.stock + coalesce(old.qty, 0) < n.quantity;
  if v_problems is not null then
    raise exception using message = 'OUT_OF_STOCK', detail = v_problems::text;
  end if;

  -- Prices: the staff member's price if given, else the order's existing
  -- price for that variant, else today's catalogue price.
  update pg_temp.t_new_items n set unit_price = coalesce(n.unit_price,
           (select oi.unit_price from public.order_items oi where oi.order_id = p_order_id and oi.variant_id = n.variant_id limit 1),
           (select coalesce(v.price, p.base_price) from public.product_variants v join public.products p on p.id = v.product_id where v.id = n.variant_id));

  select sum(n.unit_price * n.quantity) into v_subtotal from pg_temp.t_new_items n;

  v_discount := coalesce((p_payload->>'discount')::numeric, 0);
  if v_discount < 0 or v_discount > v_subtotal or round(v_discount, 2) <> v_discount then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'discount', 'reason', 'Discount must be between 0 and the items total')::text;
  end if;
  if p_payload ? 'delivery_charge' and jsonb_typeof(p_payload->'delivery_charge') = 'number' then
    v_delivery := (p_payload->>'delivery_charge')::numeric;
    if v_delivery < 0 or v_delivery > 100000 or round(v_delivery, 2) <> v_delivery then
      raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'delivery_charge', 'reason', 'Enter a delivery charge from 0')::text;
    end if;
  else
    v_delivery := public.delivery_charge_for(v_zone.charge, v_zone.free_over, v_subtotal - v_discount);
  end if;
  v_total := v_subtotal - v_discount + v_delivery;

  if v_new then
    select s.order_ref_prefix into v_prefix from public.store_settings s where s.id = 1;
    for attempt in 1..5 loop
      v_ref := public.generate_public_ref(coalesce(v_prefix, 'SD'));
      exit when not exists (select 1 from public.orders o where o.public_ref = v_ref);
      if attempt = 5 then
        raise exception 'could not allocate an order reference';
      end if;
    end loop;
    insert into public.orders (
      public_ref, idempotency_key, status, customer_name, customer_phone, address, district, area,
      zone_id, zone_name, note, subtotal, discount, delivery_charge, total, source, created_by, assigned_to,
      confirmed_at
    ) values (
      v_ref, v_key, case when p_payload->>'status' = 'confirmed' then 'confirmed'::public.order_status else 'pending' end,
      v_name, v_phone, v_address, v_district, v_area, v_zone.id, v_zone.name, v_note,
      v_subtotal, v_discount, v_delivery, v_total, v_source, auth.uid(),
      (select a.user_id from public.admin_profiles a where a.user_id = auth.uid()),
      case when p_payload->>'status' = 'confirmed' then now() end
    ) returning id into v_id;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (v_id, null, 'pending', auth.uid(), 'Manual order (' || v_source || ')');
    if p_payload->>'status' = 'confirmed' then
      insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (v_id, 'pending', 'confirmed', auth.uid());
    end if;
  else
    v_id := p_order_id;
    if v_order.paid_amount > v_total then
      raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'discount', 'reason', 'The new total is less than the amount already paid')::text;
    end if;
  end if;

  -- Stock: per variant, new quantity minus old quantity.
  with old as (
    select oi.variant_id, sum(oi.quantity)::int as qty from public.order_items oi
     where oi.order_id = v_id and oi.variant_id is not null group by oi.variant_id
  ), diff as (
    select coalesce(n.variant_id, old.variant_id) as variant_id,
           coalesce(n.quantity, 0) - coalesce(old.qty, 0) as delta
      from pg_temp.t_new_items n full join old on old.variant_id = n.variant_id
  ), moved as (
    update public.product_variants v set stock = v.stock - d.delta
      from diff d where v.id = d.variant_id and d.delta <> 0
    returning v.id, d.delta
  )
  insert into public.inventory_movements (variant_id, change, reason, order_id, created_by, note)
  select m.id, -m.delta, case when v_new then 'order'::public.movement_reason else 'edit' end, v_id, auth.uid(),
         case when v_new then 'Manual order' else 'Order edited' end
    from moved m;

  delete from public.order_items oi where oi.order_id = v_id;
  insert into public.order_items (order_id, product_id, variant_id, product_name, sku, variant_label, unit_price, quantity, line_total)
  select v_id, p.id, v.id, p.name, v.sku, public.variant_label(v.color, v.size, v.option3),
         n.unit_price, n.quantity, n.unit_price * n.quantity
    from pg_temp.t_new_items n
    join public.product_variants v on v.id = n.variant_id
    join public.products p on p.id = v.product_id
   order by p.name, v.sku;

  if not v_new then
    update public.orders o set
      customer_name = v_name, customer_phone = v_phone, address = v_address, district = v_district,
      area = v_area, note = v_note, zone_id = v_zone.id, zone_name = v_zone.name,
      subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery, total = v_total,
      source = coalesce(v_source, o.source)
     where o.id = v_id;
    insert into public.order_notes (order_id, kind, body, created_by)
    values (v_id, 'system', left('Order edited. Total ৳' || to_char(v_order.total, 'FM9999999990.##') || ' → ৳' || to_char(v_total, 'FM9999999990.##')
            || '. Items before: ' || coalesce(v_before, '—'), 1000), auth.uid());
  end if;

  return query select o.id, o.public_ref, o.total from public.orders o where o.id = v_id;
end;
$$;

-- ----------------------------------------------------------------- courier
create table public.courier_settings (
  id                    smallint primary key default 1 check (id = 1),
  default_courier       text check (default_courier in ('steadfast', 'pathao')),
  steadfast_base_url    text not null default 'https://portal.packzy.com/api/v1' check (steadfast_base_url ~ '^https://'),
  steadfast_api_key     text,
  steadfast_secret_key  text,
  steadfast_webhook_token text,
  pathao_sandbox        boolean not null default false,
  pathao_client_id      text,
  pathao_client_secret  text,
  pathao_username       text,
  pathao_password       text,
  pathao_store_id       text,
  pathao_webhook_secret text,
  pathao_integration_secret text,
  pathao_token          text,
  pathao_token_expires_at timestamptz,
  default_weight_kg     numeric(4,1) not null default 0.5 check (default_weight_kg between 0.5 and 10),
  parcel_note           text check (char_length(parcel_note) <= 200),
  auto_sync             boolean not null default true,
  updated_at            timestamptz not null default now()
);
insert into public.courier_settings (id) values (1);
create trigger courier_settings_updated_at before update on public.courier_settings for each row execute function public.set_updated_at();
alter table public.courier_settings enable row level security;
-- No grants, no policies: only security definer functions and the service role.
revoke all on public.courier_settings from public, anon, authenticated;

create or replace function public.mask_secret(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p is null or p = '' then null when length(p) <= 4 then '••••' else '••••' || right(p, 4) end;
$$;

create or replace function public.get_courier_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.courier_settings%rowtype;
begin
  perform public.require_permission('courier_settings');
  select * into c from public.courier_settings where id = 1;
  return jsonb_build_object(
    'default_courier', c.default_courier,
    'steadfast_base_url', c.steadfast_base_url,
    'steadfast_api_key', public.mask_secret(c.steadfast_api_key),
    'steadfast_secret_key', public.mask_secret(c.steadfast_secret_key),
    'steadfast_webhook_token', public.mask_secret(c.steadfast_webhook_token),
    'pathao_sandbox', c.pathao_sandbox,
    'pathao_client_id', public.mask_secret(c.pathao_client_id),
    'pathao_client_secret', public.mask_secret(c.pathao_client_secret),
    'pathao_username', c.pathao_username,
    'pathao_password', public.mask_secret(c.pathao_password),
    'pathao_store_id', c.pathao_store_id,
    'pathao_webhook_secret', public.mask_secret(c.pathao_webhook_secret),
    'pathao_integration_secret', public.mask_secret(c.pathao_integration_secret),
    'default_weight_kg', c.default_weight_kg,
    'parcel_note', c.parcel_note,
    'auto_sync', c.auto_sync,
    'steadfast_ready', c.steadfast_api_key is not null and c.steadfast_secret_key is not null,
    'pathao_ready', c.pathao_client_id is not null and c.pathao_client_secret is not null
                    and c.pathao_username is not null and c.pathao_password is not null and c.pathao_store_id is not null
  );
end;
$$;

-- Which couriers are ready, for the Send buttons (no secrets).
create or replace function public.courier_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.courier_settings%rowtype;
begin
  perform public.require_permission('courier');
  select * into c from public.courier_settings where id = 1;
  return jsonb_build_object(
    'default_courier', c.default_courier,
    'steadfast', c.steadfast_api_key is not null and c.steadfast_secret_key is not null,
    'pathao', c.pathao_client_id is not null and c.pathao_client_secret is not null
              and c.pathao_username is not null and c.pathao_password is not null and c.pathao_store_id is not null);
end;
$$;

-- Secret fields: missing or empty → keep the stored value; the literal
-- "__clear__" removes it. Plain fields are replaced.
create or replace function public.save_courier_settings(p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k text;
begin
  perform public.require_permission('courier_settings');
  if p->>'default_courier' is not null and p->>'default_courier' not in ('', 'steadfast', 'pathao') then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'default_courier', 'reason', 'Unknown courier')::text;
  end if;
  foreach k in array array['steadfast_api_key', 'steadfast_secret_key', 'steadfast_webhook_token', 'pathao_client_id',
                           'pathao_client_secret', 'pathao_password', 'pathao_webhook_secret', 'pathao_integration_secret'] loop
    if char_length(coalesce(p->>k, '')) > 300 then
      raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', k, 'reason', 'Too long')::text;
    end if;
  end loop;
  update public.courier_settings c set
    default_courier = case when p ? 'default_courier' then nullif(p->>'default_courier', '') else c.default_courier end,
    steadfast_base_url = coalesce(nullif(btrim(p->>'steadfast_base_url'), ''), c.steadfast_base_url),
    steadfast_api_key = case when p->>'steadfast_api_key' = '__clear__' then null else coalesce(nullif(btrim(p->>'steadfast_api_key'), ''), c.steadfast_api_key) end,
    steadfast_secret_key = case when p->>'steadfast_secret_key' = '__clear__' then null else coalesce(nullif(btrim(p->>'steadfast_secret_key'), ''), c.steadfast_secret_key) end,
    steadfast_webhook_token = case when p->>'steadfast_webhook_token' = '__clear__' then null else coalesce(nullif(btrim(p->>'steadfast_webhook_token'), ''), c.steadfast_webhook_token) end,
    pathao_sandbox = coalesce((p->>'pathao_sandbox')::boolean, c.pathao_sandbox),
    pathao_client_id = case when p->>'pathao_client_id' = '__clear__' then null else coalesce(nullif(btrim(p->>'pathao_client_id'), ''), c.pathao_client_id) end,
    pathao_client_secret = case when p->>'pathao_client_secret' = '__clear__' then null else coalesce(nullif(btrim(p->>'pathao_client_secret'), ''), c.pathao_client_secret) end,
    pathao_username = case when p ? 'pathao_username' then nullif(btrim(p->>'pathao_username'), '') else c.pathao_username end,
    pathao_password = case when p->>'pathao_password' = '__clear__' then null else coalesce(nullif(p->>'pathao_password', ''), c.pathao_password) end,
    pathao_store_id = case when p ? 'pathao_store_id' then nullif(btrim(p->>'pathao_store_id'), '') else c.pathao_store_id end,
    pathao_webhook_secret = case when p->>'pathao_webhook_secret' = '__clear__' then null else coalesce(nullif(btrim(p->>'pathao_webhook_secret'), ''), c.pathao_webhook_secret) end,
    pathao_integration_secret = case when p->>'pathao_integration_secret' = '__clear__' then null else coalesce(nullif(btrim(p->>'pathao_integration_secret'), ''), c.pathao_integration_secret) end,
    default_weight_kg = coalesce((p->>'default_weight_kg')::numeric, c.default_weight_kg),
    parcel_note = case when p ? 'parcel_note' then nullif(btrim(p->>'parcel_note'), '') else c.parcel_note end,
    auto_sync = coalesce((p->>'auto_sync')::boolean, c.auto_sync),
    -- new Pathao credentials → fetch a fresh token
    pathao_token = case when p ? 'pathao_client_id' or p ? 'pathao_client_secret' or p ? 'pathao_username' or p ? 'pathao_password' or p ? 'pathao_sandbox'
                        then null else c.pathao_token end
   where c.id = 1;
end;
$$;

-- Courier status text (Steadfast delivery_status, Pathao order_status or
-- event) → the order status it means, or null for "still with the courier".
create or replace function public.courier_status_to_order(p_raw text)
returns public.order_status
language sql
immutable
set search_path = ''
as $$
  select case
    when s in ('delivered', 'partial_delivered', 'partial_delivery', 'delivered_approval_pending',
               'partial_delivered_approval_pending') then 'delivered'::public.order_status
    when s in ('cancelled', 'cancelled_approval_pending', 'return', 'returned', 'paid_return', 'return_to_merchant',
               'returned_to_merchant', 'pickup_cancel', 'pickup_cancelled') then 'returned'::public.order_status
    else null
  end
  from (select regexp_replace(regexp_replace(lower(btrim(coalesce(p_raw, ''))), '[^a-z]+', '_', 'g'), '^order_|_$', '', 'g') as s) x;
$$;

-- Step 1 of sending a parcel. Checks permission, claims the order for two
-- minutes (so a double click or two staff cannot book it twice) and returns
-- the parcel details from the database — never from the browser.
create or replace function public.begin_courier_send(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  perform public.require_permission('courier');
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.deleted_at is not null then
    raise exception using message = 'NOT_FOUND';
  end if;
  if o.courier_consignment_id is not null then
    raise exception using message = 'ALREADY_SENT', detail = jsonb_build_object('courier', o.courier, 'consignment_id', o.courier_consignment_id)::text;
  end if;
  if o.status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') then
    raise exception using message = 'BAD_TRANSITION', detail = jsonb_build_object('from', o.status, 'to', 'shipped')::text;
  end if;
  if o.courier_lock_at is not null and o.courier_lock_at > now() - interval '2 minutes' then
    raise exception using message = 'BUSY';
  end if;
  update public.orders set courier_lock_at = now(), courier_error = null where id = p_order_id;
  return jsonb_build_object(
    'id', o.id, 'public_ref', o.public_ref, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
    'address', concat_ws(', ', o.address, o.area, o.district), 'district', o.district, 'note', o.note,
    'cod_amount', greatest(o.total - o.paid_amount, 0),
    'item_quantity', (select coalesce(sum(oi.quantity), 0) from public.order_items oi where oi.order_id = o.id),
    'item_description', (select left(string_agg(oi.product_name || coalesce(' ' || nullif(oi.variant_label, ''), '') || ' x' || oi.quantity, ', ' order by oi.created_at), 250)
                           from public.order_items oi where oi.order_id = o.id));
end;
$$;

-- Step 2a: the courier accepted the parcel. The order moves to shipped.
create or replace function public.record_courier_booking(
  p_order_id uuid, p_courier text, p_consignment_id text, p_tracking_code text, p_status text, p_charge numeric
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  perform public.require_permission('courier');
  if p_courier not in ('steadfast', 'pathao') or nullif(btrim(coalesce(p_consignment_id, '')), '') is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'courier', 'reason', 'Missing consignment')::text;
  end if;
  select status into v_status from public.orders where id = p_order_id and courier_consignment_id is null for update;
  if v_status is null then
    raise exception using message = 'ALREADY_SENT';
  end if;
  update public.orders set
    courier = p_courier, courier_consignment_id = left(p_consignment_id, 60), courier_tracking_code = left(p_tracking_code, 60),
    courier_status = left(p_status, 60), courier_charge = p_charge, courier_sent_at = now(), courier_synced_at = now(),
    courier_lock_at = null, courier_error = null
   where id = p_order_id;
  if 'shipped' = any (public.allowed_next_statuses(v_status)) then
    perform public.apply_order_status(p_order_id, 'shipped',
      'Sent to ' || initcap(p_courier) || ' (consignment ' || left(p_consignment_id, 60) || ')', auth.uid());
  end if;
end;
$$;

-- Step 2b: the courier refused or could not be reached.
create or replace function public.fail_courier_send(p_order_id uuid, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('courier');
  update public.orders set courier_lock_at = null, courier_error = left(coalesce(p_error, 'Courier error'), 500)
   where id = p_order_id and courier_consignment_id is null;
end;
$$;

-- Webhook and cron (service role only): store the courier's status and move
-- the order when it means delivered or returned.
create or replace function public.apply_courier_status(p_courier text, p_consignment_id text, p_raw_status text, p_charge numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_to public.order_status := public.courier_status_to_order(p_raw_status);
begin
  select * into o from public.orders
   where courier = p_courier and courier_consignment_id = p_consignment_id for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  update public.orders set courier_status = left(p_raw_status, 60), courier_synced_at = now(),
         courier_charge = coalesce(p_charge, courier_charge)
   where id = o.id;
  if v_to is not null and v_to <> o.status and o.deleted_at is null and v_to = any (public.allowed_next_statuses(o.status)) then
    perform public.apply_order_status(o.id, v_to, initcap(p_courier) || ': ' || left(p_raw_status, 60), null);
    return jsonb_build_object('found', true, 'status', v_to);
  end if;
  return jsonb_build_object('found', true, 'status', o.status);
end;
$$;

-- Orders the cron should ask the courier about (oldest check first).
create or replace function public.courier_sync_queue(p_limit int default 50)
returns table (id uuid, courier text, consignment_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.courier, o.courier_consignment_id
    from public.orders o
   where o.status = 'shipped' and o.courier_consignment_id is not null and o.deleted_at is null
     and (o.courier_synced_at is null or o.courier_synced_at < now() - interval '30 minutes')
   order by o.courier_synced_at nulls first
   limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------- Facebook / marketing
create table public.marketing_settings (
  id                smallint primary key default 1 check (id = 1),
  capi_enabled      boolean not null default false,
  capi_token        text,
  capi_test_code    text check (char_length(capi_test_code) <= 40),
  graph_version     text not null default 'v21.0' check (graph_version ~ '^v[0-9]{1,3}\.[0-9]$'),
  updated_at        timestamptz not null default now()
);
insert into public.marketing_settings (id) values (1);
create trigger marketing_settings_updated_at before update on public.marketing_settings for each row execute function public.set_updated_at();
alter table public.marketing_settings enable row level security;
revoke all on public.marketing_settings from public, anon, authenticated;

create table public.capi_events (
  id          bigint generated always as identity primary key,
  order_id    uuid references public.orders (id) on delete cascade,
  event_name  text not null,
  event_id    text not null,
  ok          boolean not null,
  response    text check (char_length(response) <= 1000),
  created_at  timestamptz not null default now()
);
create index capi_events_created_idx on public.capi_events (created_at desc);
alter table public.capi_events enable row level security;
revoke all on public.capi_events from anon;
grant select on public.capi_events to authenticated;
create policy capi_events_admin_read on public.capi_events
  for select to authenticated using ((select public.has_permission('marketing')));

create or replace function public.get_marketing_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.marketing_settings%rowtype;
begin
  perform public.require_permission('marketing');
  select * into m from public.marketing_settings where id = 1;
  return jsonb_build_object(
    'fb_pixel_id', (select s.fb_pixel_id from public.store_settings s where s.id = 1),
    'capi_enabled', m.capi_enabled,
    'capi_token', public.mask_secret(m.capi_token),
    'capi_test_code', m.capi_test_code,
    'graph_version', m.graph_version);
end;
$$;

create or replace function public.save_marketing_settings(p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pixel text := nullif(regexp_replace(coalesce(p->>'fb_pixel_id', ''), '\s', '', 'g'), '');
begin
  perform public.require_permission('marketing');
  if v_pixel is not null and v_pixel !~ '^[0-9]{6,20}$' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'fb_pixel_id', 'reason', 'The Pixel ID is a number (Events Manager → Data sources)')::text;
  end if;
  if char_length(coalesce(p->>'capi_token', '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'capi_token', 'reason', 'Too long')::text;
  end if;
  update public.store_settings set fb_pixel_id = v_pixel where id = 1;
  update public.marketing_settings m set
    capi_enabled = coalesce((p->>'capi_enabled')::boolean, m.capi_enabled),
    capi_token = case when p->>'capi_token' = '__clear__' then null else coalesce(nullif(btrim(p->>'capi_token'), ''), m.capi_token) end,
    capi_test_code = case when p ? 'capi_test_code' then nullif(btrim(p->>'capi_test_code'), '') else m.capi_test_code end,
    graph_version = coalesce(nullif(btrim(p->>'graph_version'), ''), m.graph_version)
   where m.id = 1;
end;
$$;

-- ------------------------------------------------------------------ grants
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.coupon_discount(text, numeric, boolean) from authenticated;
revoke execute on function public.apply_courier_status(text, text, text, numeric) from authenticated;
revoke execute on function public.courier_sync_queue(int) from authenticated;
revoke execute on function public.mask_secret(text) from authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.quote_order(jsonb, uuid, text) to anon, authenticated;
grant execute on function public.normalize_bd_phone(text) to anon, authenticated;
grant execute on function public.variant_label(text, text, text) to anon, authenticated;
grant execute on function public.courier_status_to_order(text) to authenticated;

grant execute on function public.block_phone(text, text) to authenticated;
grant execute on function public.unblock_phone(text) to authenticated;
grant execute on function public.customers_list(text, text, int, int) to authenticated;
grant execute on function public.staff_list() to authenticated;
grant execute on function public.save_staff(uuid, text, public.admin_role, boolean) to authenticated;
grant execute on function public.set_role_permissions(public.admin_role, text[]) to authenticated;
grant execute on function public.admin_save_order(uuid, jsonb) to authenticated;
grant execute on function public.get_courier_settings() to authenticated;
grant execute on function public.courier_options() to authenticated;
grant execute on function public.save_courier_settings(jsonb) to authenticated;
grant execute on function public.begin_courier_send(uuid) to authenticated;
grant execute on function public.record_courier_booking(uuid, text, text, text, text, numeric) to authenticated;
grant execute on function public.fail_courier_send(uuid, text) to authenticated;
grant execute on function public.get_marketing_settings() to authenticated;
grant execute on function public.save_marketing_settings(jsonb) to authenticated;

grant execute on function public.apply_courier_status(text, text, text, numeric) to service_role;
grant execute on function public.courier_sync_queue(int) to service_role;
