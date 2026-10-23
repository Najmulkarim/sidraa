-- 0007 — the only code paths that create orders, move order status and
-- change stock. All are security definer with an empty search_path, so
-- every name is schema-qualified.
--
-- Error convention: functions raise SQLSTATE P0001 with a short machine
-- code as the message (INVALID_INPUT, ZONE_INVALID, UNAVAILABLE,
-- OUT_OF_STOCK, FORBIDDEN, BAD_TRANSITION, NEGATIVE_STOCK, NOT_FOUND)
-- and a JSON detail the server turns into a friendly message.

-- ---------------------------------------------------------------- helpers

-- Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, with spaces or
-- dashes. Returns the 11-digit local form, or null when it is not a valid
-- Bangladeshi mobile number.
create or replace function public.normalize_bd_phone(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d ~ '^8801[3-9][0-9]{8}$' then
    d := substr(d, 3);
  end if;
  if d ~ '^01[3-9][0-9]{8}$' then
    return d;
  end if;
  return null;
end;
$$;

create or replace function public.delivery_charge_for(p_charge numeric, p_free_over numeric, p_subtotal numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_free_over is not null and p_subtotal >= p_free_over then 0::numeric
              else p_charge end;
$$;

-- Parses and merges the items array: [{variant_id, quantity}, ...].
-- Same variant twice → quantities added. 1–20 distinct lines, 1–20 each.
create or replace function public.parse_order_items(p_items jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out jsonb;
  v_bad int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception using message = 'INVALID_INPUT',
      detail = jsonb_build_object('field', 'items', 'reason', 'Cart must have 1 to 20 lines')::text;
  end if;

  select count(*) into v_bad
  from jsonb_array_elements(p_items) e
  where jsonb_typeof(e) <> 'object'
     or coalesce(e->>'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(e->>'quantity', '') !~ '^[0-9]{1,3}$'
     or (e->>'quantity')::int not between 1 and 20;
  if v_bad > 0 then
    raise exception using message = 'INVALID_INPUT',
      detail = jsonb_build_object('field', 'items', 'reason', 'Each line needs a variant and a quantity from 1 to 20')::text;
  end if;

  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', qty) order by variant_id)
    into v_out
  from (
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) s;

  if exists (select 1 from jsonb_array_elements(v_out) x where (x->>'quantity')::int > 20) then
    raise exception using message = 'INVALID_INPUT',
      detail = jsonb_build_object('field', 'items', 'reason', 'At most 20 of one item per order')::text;
  end if;
  return v_out;
end;
$$;

-- 8 Crockford base32 characters, one per random byte (uniform because 256
-- is a multiple of 32): 32^8 ≈ 1.1 trillion values. Shown as PREFIX-XXXX-XXXX.
create or replace function public.generate_public_ref(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  b bytea := extensions.gen_random_bytes(8);
  s text := '';
begin
  for i in 0..7 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return p_prefix || '-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end;
$$;

-- Accepts "sd 7k2m 9qxa", "SD7K2M9QXA", "SD-7K2M-9QXA"; maps the easily
-- confused O/I/L to 0/1/1 in the random part.
create or replace function public.canonical_public_ref(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  x text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
  body text;
begin
  if length(x) < 10 or length(x) > 12 then
    return null;
  end if;
  body := translate(right(x, 8), 'OIL', '011');
  return left(x, length(x) - 8) || '-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end;
$$;

-- ------------------------------------------------------------ quote_order
-- Server-side price quote used by the cart page. Reads only; prices come
-- from the database, never from the caller. Lines that are unavailable
-- carry no name or price.
create or replace function public.quote_order(p_items jsonb, p_zone_id uuid default null, p_coupon text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lines    jsonb := public.parse_order_items(p_items);
  v_result   jsonb;
  v_subtotal numeric(12,2);
  v_zone     public.delivery_zones%rowtype;
  v_delivery numeric(12,2) := null;
  v_coupon   jsonb := null;
  v_discount numeric(12,2) := 0;
begin
  select coalesce(jsonb_agg(line order by ord), '[]'::jsonb), coalesce(sum((line->>'line_total')::numeric) filter (where line->>'state' = 'ok'), 0)
    into v_result, v_subtotal
  from (
    select l.ord,
      case
        when v.id is null or not v.is_active or p.status <> 'published' then
          jsonb_build_object('variant_id', l.variant_id, 'quantity', l.quantity, 'state', 'unavailable', 'line_total', 0)
        else
          jsonb_build_object(
            'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
            'sku', v.sku, 'variant_label', public.variant_label(v.color, v.size, v.option3),
            'unit_price', coalesce(v.price, p.base_price),
            'quantity', l.quantity,
            'line_total', coalesce(v.price, p.base_price) * least(l.quantity, v.stock),
            'stock_left', v.stock,
            'state', case when v.stock = 0 then 'sold_out' when v.stock < l.quantity then 'insufficient' else 'ok' end)
      end as line
    from rows from (jsonb_to_recordset(v_lines) as (variant_id uuid, quantity int)) with ordinality as l(variant_id, quantity, ord)
    left join public.product_variants v on v.id = l.variant_id
    left join public.products p on p.id = v.product_id
  ) s;

  -- Coupon (0011): checked, never consumed, by a quote.
  if nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    select jsonb_build_object('code', c.code, 'discount', c.discount, 'error', c.error), coalesce(c.discount, 0)
      into v_coupon, v_discount
      from public.coupon_discount(p_coupon, v_subtotal, false) c;
  end if;

  if p_zone_id is not null then
    select * into v_zone from public.delivery_zones where id = p_zone_id and is_active;
    if found then
      v_delivery := public.delivery_charge_for(v_zone.charge, v_zone.free_over, v_subtotal - v_discount);
    end if;
  end if;

  return jsonb_build_object(
    'lines', v_result,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'coupon', v_coupon,
    'delivery_charge', v_delivery,
    'total', case when v_delivery is null then null else v_subtotal - v_discount + v_delivery end
  );
end;
$$;

-- ------------------------------------------------------------ place_order
create or replace function public.place_order(p_payload jsonb, p_ip_hash text default null)
returns table (public_ref text, total numeric, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key       uuid;
  v_existing  record;
  v_name      text := btrim(coalesce(p_payload->>'customer_name', ''));
  v_phone     text := public.normalize_bd_phone(p_payload->>'customer_phone');
  v_address   text := btrim(coalesce(p_payload->>'address', ''));
  v_district  text := btrim(coalesce(p_payload->>'district', ''));
  v_area      text := nullif(btrim(coalesce(p_payload->>'area', '')), '');
  v_note      text := nullif(btrim(coalesce(p_payload->>'note', '')), '');
  v_zone      public.delivery_zones%rowtype;
  v_lines     jsonb;
  v_problems  jsonb;
  v_subtotal  numeric(12,2);
  v_delivery  numeric(12,2);
  v_cerr      text;
  v_discount  numeric(12,2) := 0;
  v_code      text := nullif(upper(btrim(coalesce(p_payload->>'coupon_code', ''))), '');
  v_prefix    text;
  v_ref       text;
  v_order_id  uuid;
begin
  -- 1. Idempotency: one order per key, even under concurrent retries.
  begin
    v_key := (p_payload->>'idempotency_key')::uuid;
  exception when others then
    v_key := null;
  end;
  if v_key is null then
    raise exception using message = 'INVALID_INPUT',
      detail = jsonb_build_object('field', 'idempotency_key', 'reason', 'Missing or invalid')::text;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));

  select o.public_ref, o.total into v_existing from public.orders o where o.idempotency_key = v_key;
  if found then
    return query select v_existing.public_ref, v_existing.total, false;
    return;
  end if;

  -- 2. Validate the customer fields (the app validates too; this is the backstop).
  if char_length(v_name) not between 2 and 80 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'customer_name', 'reason', 'Enter your name')::text;
  end if;
  if v_phone is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'customer_phone', 'reason', 'Enter a valid Bangladeshi mobile number')::text;
  end if;
  if char_length(v_address) not between 5 and 300 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'address', 'reason', 'Enter your full address')::text;
  end if;
  if char_length(v_district) not between 2 and 60 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'district', 'reason', 'Enter your district')::text;
  end if;
  if char_length(coalesce(v_area, '')) > 60 or char_length(coalesce(v_note, '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Too long')::text;
  end if;

  -- Numbers the shop has blocked (fake orders) cannot order online (0011).
  if exists (select 1 from public.blocked_phones b where b.phone = v_phone) then
    raise exception using message = 'BLOCKED';
  end if;

  begin
    select * into v_zone from public.delivery_zones
     where id = (p_payload->>'zone_id')::uuid and is_active;
  exception when invalid_text_representation then
    null;
  end;
  if v_zone.id is null then
    raise exception using message = 'ZONE_INVALID', detail = jsonb_build_object('field', 'zone_id', 'reason', 'Choose a delivery area')::text;
  end if;

  v_lines := public.parse_order_items(p_payload->'items');

  -- 3. Lock the variant rows in id order (parse_order_items sorts by id),
  --    so two checkouts touching the same variants never deadlock.
  perform 1
    from public.product_variants v
   where v.id in (select (x->>'variant_id')::uuid from jsonb_array_elements(v_lines) x)
   order by v.id
     for update;

  -- 4. Availability and stock, reported for every problem line at once.
  select jsonb_agg(jsonb_build_object(
           'variant_id', l.variant_id,
           'product_name', case when p.status = 'published' then p.name end,
           'variant_label', case when p.status = 'published' then public.variant_label(v.color, v.size, v.option3) end,
           'requested', l.quantity,
           'available', case when v.id is null or not v.is_active or p.status <> 'published' then 0 else v.stock end))
    into v_problems
  from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity int)
  left join public.product_variants v on v.id = l.variant_id
  left join public.products p on p.id = v.product_id
  where v.id is null or not v.is_active or p.status <> 'published' or v.stock < l.quantity;

  if v_problems is not null then
    raise exception using message = 'OUT_OF_STOCK', detail = v_problems::text;
  end if;

  -- 5. Price every line from the database.
  select sum(coalesce(v.price, p.base_price) * l.quantity)
    into v_subtotal
  from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity int)
  join public.product_variants v on v.id = l.variant_id
  join public.products p on p.id = v.product_id;

  -- Coupon: the row is locked so its usage limit holds under concurrency.
  if v_code is not null then
    select c.code, c.discount, c.error into v_code, v_discount, v_cerr
      from public.coupon_discount(v_code, v_subtotal, true) c;
    if v_cerr is not null then
      raise exception using message = 'COUPON_INVALID', detail = jsonb_build_object('field', 'coupon_code', 'reason', v_cerr)::text;
    end if;
    update public.coupons c set used_count = c.used_count + 1 where c.code = v_code;
  end if;

  v_delivery := public.delivery_charge_for(v_zone.charge, v_zone.free_over, v_subtotal - v_discount);

  -- 6. Reference, order, items, stock, movements, history.
  select s.order_ref_prefix into v_prefix from public.store_settings s where s.id = 1;
  v_prefix := coalesce(v_prefix, 'SD');

  for attempt in 1..5 loop
    v_ref := public.generate_public_ref(v_prefix);
    exit when not exists (select 1 from public.orders o where o.public_ref = v_ref);
    if attempt = 5 then
      raise exception 'could not allocate an order reference';
    end if;
  end loop;

  insert into public.orders (
    public_ref, idempotency_key, customer_name, customer_phone, address, district, area,
    zone_id, zone_name, note, subtotal, discount, delivery_charge, total, ip_hash, coupon_code
  ) values (
    v_ref, v_key, v_name, v_phone, v_address, v_district, v_area,
    v_zone.id, v_zone.name, v_note, v_subtotal, v_discount, v_delivery, v_subtotal - v_discount + v_delivery, p_ip_hash,
    v_code
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, variant_id, product_name, sku, variant_label, unit_price, quantity, line_total)
  select v_order_id, p.id, v.id, p.name, v.sku,
         public.variant_label(v.color, v.size, v.option3),
         coalesce(v.price, p.base_price), l.quantity, coalesce(v.price, p.base_price) * l.quantity
  from rows from (jsonb_to_recordset(v_lines) as (variant_id uuid, quantity int)) with ordinality as l(variant_id, quantity, ord)
  join public.product_variants v on v.id = l.variant_id
  join public.products p on p.id = v.product_id
  order by l.ord;

  update public.product_variants v
     set stock = v.stock - l.quantity
    from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity int)
   where v.id = l.variant_id;

  insert into public.inventory_movements (variant_id, change, reason, order_id)
  select l.variant_id, -l.quantity, 'order', v_order_id
  from jsonb_to_recordset(v_lines) as l(variant_id uuid, quantity int);

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order_id, null, 'pending', 'Order placed');

  return query select v_ref, (v_subtotal - v_discount + v_delivery)::numeric, true;
end;
$$;

-- ------------------------------------------------------- set_order_status
-- Forward moves along pending → confirmed → processing → shipped →
-- delivered (skipping steps is allowed); cancel from pending, confirmed or
-- processing; return from shipped or delivered. cancelled and returned are
-- final. Stock goes back exactly once (stock_released).
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns public.order_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order  public.orders%rowtype;
  v_rank   constant text[] := array['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  v_from   int;
  v_to     int;
  v_ok     boolean;
  v_reason public.movement_reason;
begin
  perform public.require_permission('orders');
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Note is too long')::text;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;

  v_from := array_position(v_rank, v_order.status::text);
  v_to   := array_position(v_rank, p_status::text);

  v_ok := case
    when v_order.status in ('cancelled', 'returned')            then false
    when p_status = 'cancelled'                                   then v_order.status in ('pending', 'confirmed', 'processing')
    when p_status = 'returned'                                    then v_order.status in ('shipped', 'delivered')
    else v_to is not null and v_from is not null and v_to > v_from
  end;

  if not v_ok then
    raise exception using message = 'BAD_TRANSITION',
      detail = jsonb_build_object('from', v_order.status, 'to', p_status)::text;
  end if;

  update public.orders o set
    status        = p_status,
    confirmed_at  = case when p_status = 'confirmed'  then now() else o.confirmed_at  end,
    processing_at = case when p_status = 'processing' then now() else o.processing_at end,
    shipped_at    = case when p_status = 'shipped'    then now() else o.shipped_at    end,
    delivered_at  = case when p_status = 'delivered'  then now() else o.delivered_at  end,
    cancelled_at  = case when p_status = 'cancelled'  then now() else o.cancelled_at  end,
    returned_at   = case when p_status = 'returned'   then now() else o.returned_at   end
  where o.id = p_order_id;

  if p_status in ('cancelled', 'returned') and not v_order.stock_released then
    v_reason := case when p_status = 'cancelled' then 'cancel' else 'return' end;

    -- Lock in id order, like place_order().
    perform 1 from public.product_variants v
     where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
     order by v.id for update;

    update public.product_variants v
       set stock = v.stock + q.qty
      from (select oi.variant_id, sum(oi.quantity)::int as qty
              from public.order_items oi
             where oi.order_id = p_order_id and oi.variant_id is not null
             group by oi.variant_id) q
     where v.id = q.variant_id;

    insert into public.inventory_movements (variant_id, change, reason, order_id, created_by)
    select oi.variant_id, sum(oi.quantity)::int, v_reason, p_order_id, auth.uid()
      from public.order_items oi
     where oi.order_id = p_order_id and oi.variant_id is not null
     group by oi.variant_id;

    update public.orders set stock_released = true where id = p_order_id;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, p_status, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  return p_status;
end;
$$;

-- ----------------------------------------------------------- adjust_stock
-- Manual stock changes by an admin: restock (delivery from a supplier) or
-- adjust (count correction, damage write-off). Returns the new stock.
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_change     int,
  p_reason     public.movement_reason,
  p_note       text default null
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  perform public.require_permission('inventory');
  if p_reason not in ('restock', 'adjust') then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'reason', 'reason', 'Use restock or adjust')::text;
  end if;
  if p_change is null or p_change = 0 or abs(p_change) > 100000 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'change', 'reason', 'Enter a non-zero amount')::text;
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Note is too long')::text;
  end if;

  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_stock + p_change < 0 then
    raise exception using message = 'NEGATIVE_STOCK',
      detail = jsonb_build_object('stock', v_stock, 'change', p_change)::text;
  end if;

  update public.product_variants set stock = stock + p_change where id = p_variant_id
  returning stock into v_stock;

  insert into public.inventory_movements (variant_id, change, reason, note, created_by)
  values (p_variant_id, p_change, p_reason, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  return v_stock;
end;
$$;

-- ------------------------------------------------------------ track_order
-- Order reference + last 4 digits of the phone. Returns status, dates and
-- items only — never the address, name or full phone. Server-only.
create or replace function public.track_order(p_ref text, p_phone_last4 text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ref   text := public.canonical_public_ref(p_ref);
  v_order public.orders%rowtype;
begin
  if v_ref is null or coalesce(p_phone_last4, '') !~ '^[0-9]{4}$' then
    return null;
  end if;

  select * into v_order from public.orders o
   where o.public_ref = v_ref and right(o.customer_phone, 4) = p_phone_last4;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'public_ref', v_order.public_ref,
    'status', v_order.status,
    'placed_at', v_order.created_at,
    'confirmed_at', v_order.confirmed_at,
    'processing_at', v_order.processing_at,
    'shipped_at', v_order.shipped_at,
    'delivered_at', v_order.delivered_at,
    'cancelled_at', v_order.cancelled_at,
    'returned_at', v_order.returned_at,
    'zone_name', v_order.zone_name,
    'subtotal', v_order.subtotal,
    'delivery_charge', v_order.delivery_charge,
    'total', v_order.total,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'product_name', oi.product_name, 'variant_label', oi.variant_label,
               'quantity', oi.quantity, 'line_total', oi.line_total) order by oi.created_at, oi.id), '[]'::jsonb)
        from public.order_items oi where oi.order_id = v_order.id)
  );
end;
$$;

-- ------------------------------------------------------------------ grants
-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default; take that back and hand out only what each role needs.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin()  to anon, authenticated;
grant execute on function public.is_owner()  to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.require_permission(text) to authenticated;
grant execute on function public.quote_order(jsonb, uuid, text) to anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_stock(uuid, int, public.movement_reason, text) to authenticated;

-- Server-only: the service role key exists only in server code.
grant execute on function public.place_order(jsonb, text) to service_role;
grant execute on function public.track_order(text, text)  to service_role;
