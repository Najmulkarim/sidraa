import { NextResponse, type NextRequest } from 'next/server';
import { LAST_ORDER_COOKIE } from '@/lib/cart';
import { SITE_URL } from '@/lib/env';
import { canonicalRef } from '@/lib/order-ref';
import { bkashCreate } from '@/lib/payments/bkash';
import { bkashMerchantReady, readPaymentSettings } from '@/lib/payments/settings';
import { createAdminClient } from '@/lib/supabase/admin';

/** "Pay with bKash again" on the confirmation page: only the browser that placed the order. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const ref = canonicalRef(decodeURIComponent((await params).ref));
  if (!ref || req.cookies.get(LAST_ORDER_COOKIE)?.value !== ref) return NextResponse.redirect(new URL('/track', SITE_URL));
  const back = (q = '') => NextResponse.redirect(new URL(`/order/${ref}${q}`, SITE_URL));

  const admin = createAdminClient();
  const { data: o } = await admin
    .from('orders')
    .select('id, total, customer_phone, status, payment_method, payment_mode, payment_status')
    .eq('public_ref', ref)
    .maybeSingle<{ id: string; total: number | string; customer_phone: string; status: string; payment_method: string; payment_mode: string | null; payment_status: string }>();
  if (!o || o.payment_status === 'paid' || o.payment_method !== 'bkash' || o.payment_mode !== 'merchant' || ['cancelled', 'fake', 'delivered', 'returned', 'lost'].includes(o.status)) return back();

  const settings = await readPaymentSettings();
  if (!bkashMerchantReady(settings)) return back('?pay=failed');
  try {
    const p = await bkashCreate(settings, { amount: Number(o.total), invoice: ref, payer: o.customer_phone, callbackURL: `${SITE_URL}/api/pay/bkash/callback` });
    await admin.from('orders').update({ payment_gateway_id: p.paymentID, payment_status: 'pending' }).eq('id', o.id);
    return NextResponse.redirect(p.bkashURL);
  } catch (e) {
    console.error('[bkash] retry', ref, e);
    return back('?pay=failed');
  }
}
