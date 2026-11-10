-- 0071 — When the courier pays you (Pathao's "order.paid" message, with its
-- invoice), the order keeps that payout — when and which invoice — instead of
-- treating the message as the parcel's status. Fixes the orders whose status
-- word was replaced by "order.paid" (SD0012 had become a regular return).
-- Safe to run again.

alter table public.orders add column if not exists courier_paid_at timestamptz;
alter table public.orders add column if not exists courier_invoice_id text;

-- Payouts already received, from the courier's messages.
update public.orders o
   set courier_paid_at = coalesce(o.courier_paid_at, e.received_at),
       courier_invoice_id = coalesce(o.courier_invoice_id, left(e.payload->>'invoice_id', 60))
  from (
    select distinct on (courier, consignment_id) courier, consignment_id, received_at, payload
      from public.courier_events
     where event = 'order.paid'
     order by courier, consignment_id, received_at
  ) e
 where o.courier = e.courier and o.courier_consignment_id = e.consignment_id;

-- Put back the parcel's own status word where "order.paid" replaced it:
-- the last return kind the courier sent, else Delivered / Return.
update public.orders o
   set courier_status = coalesce(
         (select left(x.payload->>'return_type', 60) from public.courier_events x
           where x.courier = o.courier and x.consignment_id = o.courier_consignment_id
             and coalesce(x.payload->>'return_type', '') ~* 'return'
           order by x.received_at desc limit 1),
         case o.status when 'delivered' then 'Delivered' when 'returned' then 'Return' else o.courier_status end)
 where o.courier_status ilike '%paid' and o.courier_status not ilike '%return%';
