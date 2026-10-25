import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/env';
import { bkashExecute } from '@/lib/payments/bkash';
import { readPaymentSettings } from '@/lib/payments/settings';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * bKash sends the customer back here (?paymentID=…&status=success|failure|cancel).
 * The status in the link is never trusted on its own: a payment counts only
 * when bKash's execute/status call says Completed for the order's own amount.
 */
export async function GET(req: NextRequest) {
  const paymentID = req.nextUrl.searchParams.get('paymentID') ?? '';
  const status = req.nextUrl.searchParams.get('status') ?? '';
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(paymentID)) return NextResponse.redirect(new URL('/', SITE_URL));

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, public_ref, total, payment_status')
    .eq('payment_gateway_id', paymentID)
    .maybeSingle<{ id: string; public_ref: string; total: number | string; payment_status: string }>();
  if (!order) return NextResponse.redirect(new URL('/', SITE_URL));
  const back = (result: string) => NextResponse.redirect(new URL(`/order/${order.public_ref}?pay=${result}`, SITE_URL));

  if (order.payment_status === 'paid') return back('ok');
  if (status !== 'success') {
    await admin.from('orders').update({ payment_status: 'failed' }).eq('id', order.id).neq('payment_status', 'paid');
    return back(status === 'cancel' ? 'cancelled' : 'failed');
  }

  try {
    const r = await bkashExecute(await readPaymentSettings(), paymentID);
    const total = Number(order.total);
    if (r.completed && r.amount !== null && Math.abs(r.amount - total) < 0.01) {
      await admin.from('orders').update({ payment_status: 'paid', paid_amount: total, payment_trx_id: r.trxID }).eq('id', order.id);
      await admin.from('order_notes').insert({ order_id: order.id, kind: 'system', body: `Paid ৳${total} by bKash (TrxID ${r.trxID}).` });
      revalidatePath('/admin/orders');
      return back('ok');
    }
    console.warn('[bkash] not completed', order.public_ref, r.message);
    await admin.from('orders').update({ payment_status: 'failed' }).eq('id', order.id).neq('payment_status', 'paid');
    return back('failed');
  } catch (e) {
    console.error('[bkash] execute', order.public_ref, e);
    return back('failed');
  }
}
