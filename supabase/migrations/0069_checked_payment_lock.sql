-- 0069 — A checked payment is locked: only a super admin can edit it (cash,
-- delivery charge, COD fee) or undo the check; the order's notes say who and
-- when. Safe to run again.
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

  -- Once checked, a payment is locked: only a super admin can change or undo it.
  if o.payment_checked_at is not null and not public.is_owner() then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'paid', 'reason', 'This payment is already checked. Only a super admin can change it.')::text;
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
          case when o.payment_checked_at is not null then 'Checked payment edited: ৳' else 'Payment checked: ৳' end || p_paid::text || ' collected' ||
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
