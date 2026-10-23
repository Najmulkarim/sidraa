-- 0010 — day-to-day order operations for the admin Orders page:
-- extra statuses (hold, ship_later, lost, fake), paid amount, notes and
-- logs, staff assignment, soft delete, bulk status changes, tab counts
-- and per-customer delivery success rates.

alter type public.order_status add value if not exists 'hold' after 'processing';
alter type public.order_status add value if not exists 'ship_later' after 'hold';
alter type public.order_status add value if not exists 'lost' after 'returned';
alter type public.order_status add value if not exists 'fake' after 'lost';

alter table public.orders
  add column paid_amount numeric(12,2) not null default 0,
  add column assigned_to uuid references public.admin_profiles (user_id) on delete set null,
  add column deleted_at  timestamptz,
  add column hold_at     timestamptz,
  add column lost_at     timestamptz,
  add column fake_at     timestamptz,
  add constraint orders_paid_chk check (paid_amount >= 0 and paid_amount <= total);

create index orders_assigned_idx on public.orders (assigned_to, created_at desc);
create index orders_deleted_idx  on public.orders (deleted_at) where deleted_at is not null;

-- Notes typed by staff and system lines (assignment, payment, delete) — the "Logs".
create table public.order_notes (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  kind       text not null default 'note' check (kind in ('note', 'system')),
  body       text not null check (char_length(body) between 1 and 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes (order_id, created_at);

alter table public.order_notes enable row level security;
grant select, insert on public.order_notes to authenticated;
create policy order_notes_admin_read on public.order_notes
  for select to authenticated using ((select public.has_permission('orders')));
-- Staff add their own notes; system lines come only from the functions below.
create policy order_notes_admin_insert on public.order_notes
  for insert to authenticated
  with check ((select public.has_permission('orders')) and kind = 'note' and created_by = (select auth.uid()));

-- ------------------------------------------------------- status workflow
-- pending → confirmed → processing (ready to deliver) → shipped (with
-- courier) → delivered. Open orders can be put on hold / ship later,
-- cancelled or marked fake; held orders go back into the flow. A parcel
-- with the courier can be delivered, returned or lost; a delivered one
-- returned. cancelled, returned, lost and fake are final.
create or replace function public.allowed_next_statuses(p_from public.order_status)
returns public.order_status[]
language sql
immutable
set search_path = ''
as $$
  select case p_from::text
    when 'pending'    then array['confirmed','processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'confirmed'  then array['processing','shipped','delivered','hold','ship_later','cancelled','fake']
    when 'processing' then array['shipped','delivered','hold','ship_later','cancelled']
    when 'hold'       then array['pending','confirmed','processing','shipped','ship_later','cancelled','fake']
    when 'ship_later' then array['pending','confirmed','processing','shipped','hold','cancelled','fake']
    when 'shipped'    then array['delivered','returned','lost']
    when 'delivered'  then array['returned']
    else array[]::text[]
  end::public.order_status[];
$$;

-- The status engine. No permission check here: it is not callable by any
-- API role. Staff reach it through set_order_status(); the courier sync
-- (service role) through apply_courier_status() in 0011.
create or replace function public.apply_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text,
  p_actor    uuid
)
returns public.order_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order  public.orders%rowtype;
  v_reason public.movement_reason;
begin
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'note', 'reason', 'Note is too long')::text;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_order.deleted_at is not null or not (p_status = any (public.allowed_next_statuses(v_order.status))) then
    raise exception using message = 'BAD_TRANSITION',
      detail = jsonb_build_object('from', v_order.status, 'to', p_status)::text;
  end if;

  update public.orders o set
    status        = p_status,
    confirmed_at  = case when p_status = 'confirmed'  then now() else o.confirmed_at  end,
    processing_at = case when p_status = 'processing' then now() else o.processing_at end,
    hold_at       = case when p_status in ('hold', 'ship_later') then now() else o.hold_at end,
    shipped_at    = case when p_status = 'shipped'    then now() else o.shipped_at    end,
    delivered_at  = case when p_status = 'delivered'  then now() else o.delivered_at  end,
    cancelled_at  = case when p_status = 'cancelled'  then now() else o.cancelled_at  end,
    returned_at   = case when p_status = 'returned'   then now() else o.returned_at   end,
    lost_at       = case when p_status = 'lost'       then now() else o.lost_at       end,
    fake_at       = case when p_status = 'fake'       then now() else o.fake_at       end,
    -- Cash on delivery: the rider collected the full amount.
    paid_amount   = case when p_status = 'delivered'  then o.total else o.paid_amount end
  where o.id = p_order_id;

  -- Goods come back on cancel, return or fake (never for a lost parcel).
  if p_status in ('cancelled', 'returned', 'fake') and not v_order.stock_released then
    v_reason := case when p_status = 'returned' then 'return' else 'cancel' end;

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
    select oi.variant_id, sum(oi.quantity)::int, v_reason, p_order_id, p_actor
      from public.order_items oi
     where oi.order_id = p_order_id and oi.variant_id is not null
     group by oi.variant_id;

    update public.orders set stock_released = true where id = p_order_id;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, p_status, p_actor, nullif(btrim(coalesce(p_note, '')), ''));

  return p_status;
end;
$$;

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
begin
  perform public.require_permission('orders');
  return public.apply_order_status(p_order_id, p_status, p_note, auth.uid());
end;
$$;

-- Bulk status change: each order succeeds or is skipped on its own.
create or replace function public.bulk_set_order_status(p_order_ids uuid[], p_status public.order_status, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_done int := 0;
  v_skip int := 0;
begin
  perform public.require_permission('orders');
  if coalesce(array_length(p_order_ids, 1), 0) not between 1 and 200 then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'ids', 'reason', 'Select 1 to 200 orders')::text;
  end if;
  foreach v_id in array p_order_ids loop
    begin
      perform public.set_order_status(v_id, p_status, p_note);
      v_done := v_done + 1;
    exception when others then
      v_skip := v_skip + 1;
    end;
  end loop;
  return jsonb_build_object('done', v_done, 'skipped', v_skip);
end;
$$;

-- ---------------------------------------------- assignment and payment

create or replace function public.assign_order(p_order_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform public.require_permission('orders');
  if p_user_id is not null then
    select full_name into v_name from public.admin_profiles where user_id = p_user_id and is_active;
    if v_name is null then
      raise exception using message = 'NOT_FOUND';
    end if;
  end if;
  update public.orders set assigned_to = p_user_id where id = p_order_id and deleted_at is null;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (p_order_id, 'system', coalesce('Assigned to ' || v_name, 'Unassigned'), auth.uid());
end;
$$;

create or replace function public.record_payment(p_order_id uuid, p_paid numeric, p_note text default null)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total numeric;
begin
  perform public.require_permission('orders');
  select total into v_total from public.orders where id = p_order_id and deleted_at is null for update;
  if v_total is null then
    raise exception using message = 'NOT_FOUND';
  end if;
  if p_paid is null or p_paid < 0 or p_paid > v_total or round(p_paid, 2) <> p_paid then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'paid', 'reason', 'Paid must be between 0 and the order total')::text;
  end if;
  update public.orders set paid_amount = p_paid where id = p_order_id;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (p_order_id, 'system', 'Paid set to ৳' || p_paid::text || coalesce(' — ' || nullif(btrim(p_note), ''), ''), auth.uid());
  return p_paid;
end;
$$;

-- Customer details can be corrected until the parcel goes to the courier.
create or replace function public.update_order_customer(p_order_id uuid, p_payload jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_phone text := public.normalize_bd_phone(p_payload->>'customer_phone');
begin
  perform public.require_permission('orders');
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.deleted_at is not null then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_order.status not in ('pending', 'confirmed', 'processing', 'hold', 'ship_later') then
    raise exception using message = 'BAD_TRANSITION', detail = jsonb_build_object('from', v_order.status, 'to', 'edit')::text;
  end if;
  if v_phone is null then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'customer_phone', 'reason', 'Enter a valid Bangladeshi mobile number')::text;
  end if;
  update public.orders set
    customer_name  = btrim(p_payload->>'customer_name'),
    customer_phone = v_phone,
    address        = btrim(p_payload->>'address'),
    district       = btrim(p_payload->>'district'),
    area           = nullif(btrim(coalesce(p_payload->>'area', '')), ''),
    note           = nullif(btrim(coalesce(p_payload->>'note', '')), '')
  where id = p_order_id;  -- table checks enforce lengths
  insert into public.order_notes (order_id, kind, body, created_by)
  values (p_order_id, 'system', 'Customer details edited', auth.uid());
end;
$$;

-- --------------------------------------------------------- soft delete
-- An open order is cancelled first (stock goes back); an order with the
-- courier or delivered cannot be deleted.
create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  perform public.require_permission('orders_delete');
  select status into v_status from public.orders where id = p_order_id and deleted_at is null;
  if v_status is null then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_status in ('shipped', 'delivered') then
    raise exception using message = 'BAD_TRANSITION', detail = jsonb_build_object('from', v_status, 'to', 'deleted')::text;
  end if;
  if 'cancelled' = any (public.allowed_next_statuses(v_status)) then
    perform public.apply_order_status(p_order_id, 'cancelled', 'Deleted', auth.uid());
  end if;
  update public.orders set deleted_at = now() where id = p_order_id;
  insert into public.order_notes (order_id, kind, body, created_by) values (p_order_id, 'system', 'Order deleted', auth.uid());
end;
$$;

create or replace function public.restore_order(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('orders_delete');
  update public.orders set deleted_at = null where id = p_order_id and deleted_at is not null;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  insert into public.order_notes (order_id, kind, body, created_by) values (p_order_id, 'system', 'Order restored', auth.uid());
end;
$$;

-- --------------------------------------------------- page-level queries

-- Counts for the status tabs over a Dhaka date range (null = all time).
create or replace function public.order_tab_counts(p_from date default null, p_to date default null, p_assigned uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.require_permission('orders');
  with o as (
    select * from public.orders
     where (p_from is null or created_at >= (p_from::timestamp at time zone 'Asia/Dhaka'))
       and (p_to   is null or created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Dhaka'))
       and (p_assigned is null or assigned_to = p_assigned)
  )
  select jsonb_build_object(
    'all',        (select count(*) from o where deleted_at is null),
    'deleted',    (select count(*) from o where deleted_at is not null),
    'paid',       (select count(*) from o where deleted_at is null and paid_amount > 0),
    'pending_total', (select coalesce(sum(total), 0) from o where deleted_at is null and status = 'pending'),
    'by_status',  coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from o where deleted_at is null group by status) s), '{}'::jsonb)
  ) into v;
  return v;
end;
$$;

-- Delivery record per phone number across all orders: the % shown next to
-- each customer. Finished orders only (delivered vs returned/cancelled/fake).
create or replace function public.customer_stats(p_phones text[])
returns table (phone text, orders bigint, delivered bigint, failed bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_permission('orders');
  return query
    select o.customer_phone, count(*),
           count(*) filter (where o.status = 'delivered'),
           count(*) filter (where o.status in ('returned', 'cancelled', 'fake', 'lost'))
      from public.orders o
     where o.customer_phone = any (p_phones) and o.deleted_at is null
     group by o.customer_phone;
end;
$$;

-- Names of active admins for the employee filter and assignment menu.
-- admin_profiles itself stays readable only to the owner (and each person's own row).
create or replace function public.list_staff()
returns table (user_id uuid, full_name text, role public.admin_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN';
  end if;
  return query select a.user_id, a.full_name, a.role from public.admin_profiles a where a.is_active order by a.full_name;
end;
$$;

-- ------------------------------------------------------------- grants
revoke execute on function public.apply_order_status(uuid, public.order_status, text, uuid) from public, anon, authenticated;
revoke execute on function public.allowed_next_statuses(public.order_status) from public, anon;
revoke execute on function public.bulk_set_order_status(uuid[], public.order_status, text) from public, anon, authenticated;
revoke execute on function public.assign_order(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_payment(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.update_order_customer(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_order(uuid) from public, anon, authenticated;
revoke execute on function public.restore_order(uuid) from public, anon, authenticated;
revoke execute on function public.order_tab_counts(date, date, uuid) from public, anon, authenticated;
revoke execute on function public.customer_stats(text[]) from public, anon, authenticated;
revoke execute on function public.list_staff() from public, anon, authenticated;

grant execute on function public.allowed_next_statuses(public.order_status) to authenticated;
grant execute on function public.bulk_set_order_status(uuid[], public.order_status, text) to authenticated;
grant execute on function public.assign_order(uuid, uuid) to authenticated;
grant execute on function public.record_payment(uuid, numeric, text) to authenticated;
grant execute on function public.update_order_customer(uuid, jsonb) to authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
grant execute on function public.restore_order(uuid) to authenticated;
grant execute on function public.order_tab_counts(date, date, uuid) to authenticated;
grant execute on function public.customer_stats(text[]) to authenticated;
grant execute on function public.list_staff() to authenticated;
