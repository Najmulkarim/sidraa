-- 0068 — SD0012 is a paid return: a later Pathao message ("return in transit")
-- had replaced that word. The webhook now keeps the return's kind. Safe to run again.
update public.orders
   set courier_status = 'paid_return'
 where public_ref = 'SD0012' and courier = 'pathao' and courier_status ilike '%return-in-transit%';
