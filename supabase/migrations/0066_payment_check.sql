-- 0066 — Payment check, order by order: staff confirm (or correct) what the
-- courier really collected for each finished parcel, and the order keeps who
-- checked it and when. Unchecking is allowed. Safe to run again.

alter table public.orders add column if not exists payment_checked_at timestamptz;
alter table public.orders add column if not exists payment_checked_by uuid;
alter table public.orders add column if not exists payment_checked_by_name text;

create or replace function public.check_order_payment(p_order_id uuid, p_paid numeric, p_checked boolean default true)
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

  select nullif(btrim(full_name), '') into v_name from public.admin_profiles where user_id = auth.uid();
  update public.orders
     set paid_amount = p_paid,
         payment_checked_at = now(), payment_checked_by = auth.uid(), payment_checked_by_name = left(coalesce(v_name, 'Staff'), 80)
   where id = o.id;
  insert into public.order_notes (order_id, kind, body, created_by)
  values (o.id, 'system',
          'Payment checked: ৳' || p_paid::text || ' collected' ||
          case when p_paid <> o.paid_amount then ' (was ৳' || o.paid_amount::text || ')' else '' end,
          auth.uid());
  return jsonb_build_object('checked', true, 'paid', p_paid);
end;
$$;
revoke execute on function public.check_order_payment(uuid, numeric, boolean) from public, anon;
grant execute on function public.check_order_payment(uuid, numeric, boolean) to authenticated;
