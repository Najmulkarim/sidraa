-- 0067 — COD fee rate per courier, set in one place, with history: a parcel
-- uses the rate that was in force on the day it was handed to the courier,
-- so changing the rate later never changes earlier parcels. Checking a
-- parcel's payment also saves its delivery charge and COD fee on the order
-- for good. Safe to run again.

create table if not exists public.courier_fee_rates (
  id bigint generated always as identity primary key,
  courier text not null,
  cod_rate numeric(6,3) not null check (cod_rate >= 0 and cod_rate <= 20),
  effective_from timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists courier_fee_rates_idx on public.courier_fee_rates (courier, effective_from desc);
alter table public.courier_fee_rates enable row level security;
drop policy if exists courier_fee_rates_read on public.courier_fee_rates;
create policy courier_fee_rates_read on public.courier_fee_rates for select to authenticated
  using ((select public.has_permission('revenue')));
revoke insert, update, delete on public.courier_fee_rates from anon, authenticated;
grant select on public.courier_fee_rates to authenticated;

-- What both couriers charged so far: 1% of the cash collected.
insert into public.courier_fee_rates (courier, cod_rate, effective_from, created_by)
select c, 1, '2000-01-01T00:00:00Z', null
  from unnest(array['pathao', 'steadfast']) c
 where not exists (select 1 from public.courier_fee_rates r where r.courier = c);

create or replace function public.set_courier_cod_rate(p_courier text, p_rate numeric)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('revenue');
  if p_courier not in ('pathao', 'steadfast') then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'courier', 'reason', 'Unknown courier')::text;
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 20 or round(p_rate, 3) <> p_rate then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'rate', 'reason', 'COD fee must be between 0% and 20%')::text;
  end if;
  insert into public.courier_fee_rates (courier, cod_rate, effective_from, created_by) values (p_courier, p_rate, now(), auth.uid());
end;
$$;
revoke execute on function public.set_courier_cod_rate(text, numeric) from public, anon;
grant execute on function public.set_courier_cod_rate(text, numeric) to authenticated;

-- Check: also saves the delivery charge and the COD fee on the order.
drop function if exists public.check_order_payment(uuid, numeric, boolean);
create or replace function public.check_order_payment(p_order_id uuid, p_paid numeric, p_checked boolean default true,
                                                      p_charge numeric default null, p_cod_fee numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_name text;
begin
  perform public.require_permission('revenue');
  select * into o from public.orders where id = p_order_id and deleted_at is null for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;

  if not coalesce(p_checked, true) then
    update public.orders set payment_checked_at = null, payment_checked_by = null, payment_checked_by_name = null where id = o.id;
    insert into public.order_notes (order_id, kind, body, created_by)
    values (o.id, 'system', 'Payment check undone', auth.uid());
    return jsonb_build_object('checked', false);
  end if;

  if o.status not in ('delivered', 'returned') then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'paid', 'reason', 'Only a delivered or returned order can be checked')::text;
  end if;
  if p_paid is null or p_paid < 0 or p_paid > o.total or round(p_paid, 2) <> p_paid then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'paid', 'reason', 'Collected must be between 0 and the order total')::text;
  end if;
  if (p_charge is not null and (p_charge < 0 or p_charge > 100000)) or (p_cod_fee is not null and (p_cod_fee < 0 or p_cod_fee > 100000)) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'charge', 'reason', 'Charge must be 0 or more')::text;
  end if;

  select nullif(btrim(full_name), '') into v_name from public.admin_profiles where user_id = auth.uid();
  update public.orders
     set paid_amount = p_paid,
         courier_charge = coalesce(round(p_charge, 2), courier_charge),
         courier_cod_fee = coalesce(round(p_cod_fee, 2), courier_cod_fee),
         payment_checked_at = now(), payment_checked_by = auth.uid(), payment_checked_by_name = left(coalesce(v_name, 'Staff'), 80)
   where id = o.id;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (o.id, 'system',
          'Payment checked: ৳' || p_paid::text || ' collected' ||
          case when p_paid <> o.paid_amount then ' (was ৳' || o.paid_amount::text || ')' else '' end ||
          coalesce(', delivery charge ৳' || round(p_charge, 2)::text ||
                   case when o.courier_charge is distinct from round(p_charge, 2) then ' (was ৳' || coalesce(o.courier_charge::text, '—') || ')' else '' end, '') ||
          coalesce(', COD fee ৳' || round(p_cod_fee, 2)::text, ''),
          auth.uid());
  return jsonb_build_object('checked', true, 'paid', p_paid);
end;
$$;
revoke execute on function public.check_order_payment(uuid, numeric, boolean, numeric, numeric) from public, anon;
grant execute on function public.check_order_payment(uuid, numeric, boolean, numeric, numeric) to authenticated;
