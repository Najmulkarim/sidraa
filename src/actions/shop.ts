'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { after } from 'next/server';
import { sendPurchaseEvent } from '@/lib/facebook/capi';
import { redirect } from 'next/navigation';
import { DB_FIELD_TO_FORM, mapDbError, type StockProblem } from '@/lib/db-errors';
import { clientIp, hashKey, hit, LIMITS } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { LAST_ORDER_COOKIE } from '@/lib/cart';
import { SITE_URL } from '@/lib/env';
import { normalizeBdPhone } from '@/lib/phone';
import { bkashCreate, BkashError } from '@/lib/payments/bkash';
import { allows, paymentOptions, readPaymentSettings } from '@/lib/payments/settings';
import type { ActionState, Quote, TrackResult } from '@/lib/types';
import { cartLinesSchema, checkoutSchema, fieldErrors, formToObject, trackSchema } from '@/lib/validation';

// ------------------------------------------------------------------ quote

/**
 * Prices the cart on the server (public.quote_order). The browser's cart
 * holds only variant ids and quantities; every number shown comes from here.
 */
export async function quoteCart(items: unknown, zoneId: string | null, coupon: string | null = null): Promise<{ ok: true; quote: Quote } | { ok: false; message: string }> {
  const parsed = cartLinesSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Your cart could not be read.' };
  const zone = zoneId && /^[0-9a-f-]{36}$/i.test(zoneId) ? zoneId : null;

  const { data, error } = await createPublicClient().rpc('quote_order', {
    p_items: parsed.data.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
    p_zone_id: zone,
    p_coupon: typeof coupon === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(coupon.trim()) ? coupon.trim() : null,
  });
  if (error) {
    const mapped = mapDbError(error);
    if (mapped.code === 'UNKNOWN') console.error('[quote]', error);
    return { ok: false, message: mapped.message };
  }
  return { ok: true, quote: data as Quote };
}

// --------------------------------------------------------------- checkout

export type CheckoutState = ActionState & { stock?: StockProblem[] };

const ECHO_FIELDS = ['customerName', 'customerPhone', 'address', 'district', 'area', 'zoneId', 'note', 'couponCode', 'paymentMethod', 'paymentMode', 'paymentSender', 'paymentTrxId'] as const;

/**
 * Checkout: Zod → rate limits → place_order() (one transaction: lock rows,
 * re-price, check stock, insert, decrement) → confirmation page.
 * Prices, delivery and totals sent by the browser are never read.
 */
export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const raw = formToObject(formData);
  const values = Object.fromEntries(ECHO_FIELDS.map((k) => [k, typeof raw[k] === 'string' ? (raw[k] as string).slice(0, 500) : '']));

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: fieldErrors(parsed.error), values };
  }
  const input = parsed.data;
  const admin = createAdminClient();

  // Payment: only what Settings → Payments switched on; a manual TrxID can pay for one order only.
  const paySettings = await readPaymentSettings();
  const mode = input.paymentMethod === 'cod' ? null : (input.paymentMode ?? null);
  if (!allows(paymentOptions(paySettings), input.paymentMethod, mode)) {
    return { ok: false, message: 'That payment option is not available. Please choose another.', fieldErrors: { paymentMethod: 'Not available' }, values };
  }
  if (mode === 'manual' && input.paymentTrxId) {
    const { data: used } = await admin.from('orders').select('id').eq('payment_method', input.paymentMethod).ilike('payment_trx_id', input.paymentTrxId).limit(1);
    if (used?.length) return { ok: false, message: 'This Transaction ID was already used for another order.', fieldErrors: { paymentTrxId: 'Already used' }, values };
  }

  // A retry of an order that already went through skips the limits and
  // lands on the same confirmation page.
  const { data: existing } = await admin
    .from('orders')
    .select('public_ref')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle<{ public_ref: string }>();

  const ip = await clientIp();
  if (!existing) {
    const allowed = (await hit('checkout:ip', ip, LIMITS.checkoutIp)) && (await hit('checkout:phone', input.customerPhone, LIMITS.checkoutPhone));
    if (!allowed) {
      return { ok: false, message: 'Too many orders in a short time. Please wait a few minutes and try again, or call us.', values };
    }
  }

  const { data, error } = await admin.rpc('place_order', {
    p_payload: {
      idempotency_key: input.idempotencyKey,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      address: input.address,
      district: input.district,
      area: input.area ?? null,
      zone_id: input.zoneId,
      note: input.note ?? null,
      coupon_code: input.couponCode ?? null,
      items: input.items.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
    },
    p_ip_hash: hashKey(ip),
  });

  if (error) {
    const mapped = mapDbError(error);
    if (mapped.code === 'UNKNOWN') console.error('[checkout] place_order failed', error);
    const field = mapped.field ? (DB_FIELD_TO_FORM[mapped.field] ?? mapped.field) : undefined;
    return {
      ok: false,
      message: mapped.message,
      fieldErrors: field ? { [field]: mapped.message } : undefined,
      stock: mapped.stock,
      values,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { public_ref: string; created: boolean } | undefined;
  if (!row?.public_ref) {
    console.error('[checkout] place_order returned no reference', data);
    return { ok: false, message: 'Something went wrong. Please try again.', values };
  }

  let payUrl: string | null = null;
  if (row.created && input.paymentMethod !== 'cod') {
    const { data: o } = await admin.from('orders').select('id, total').eq('public_ref', row.public_ref).single<{ id: string; total: number | string }>();
    const { error: payErr } = await admin.from('orders').update({
      payment_method: input.paymentMethod,
      payment_mode: mode,
      payment_status: 'pending',
      payment_sender: mode === 'manual' ? normalizeBdPhone(input.paymentSender ?? '') : null,
      payment_trx_id: mode === 'manual' ? input.paymentTrxId : null,
    }).eq('public_ref', row.public_ref);
    if (payErr) console.error('[checkout] saving payment details failed', row.public_ref, payErr);
    if (mode === 'merchant' && input.paymentMethod === 'bkash' && o) {
      try {
        const p = await bkashCreate(paySettings, { amount: Number(o.total), invoice: row.public_ref, payer: input.customerPhone, callbackURL: `${SITE_URL}/api/pay/bkash/callback` });
        await admin.from('orders').update({ payment_gateway_id: p.paymentID }).eq('id', o.id);
        payUrl = p.bkashURL;
      } catch (e) {
        // The order is saved; the confirmation page offers to try bKash again or pay on delivery.
        console.error('[checkout] bKash create', e instanceof BkashError ? e.message : e);
        await admin.from('orders').update({ payment_status: 'failed' }).eq('id', o.id);
      }
    }
  }

  if (row.created) {
    // Facebook Conversions API, after the response (never slows checkout).
    const jar = await cookies();
    const h = await headers();
    const ref = row.public_ref;
    const ctx = { publicRef: ref, ip, userAgent: h.get('user-agent'), fbp: jar.get('_fbp')?.value ?? null, fbc: jar.get('_fbc')?.value ?? null };
    after(() => sendPurchaseEvent({ ...ctx, ip: ctx.ip === 'unknown' ? null : ctx.ip }).catch((e) => console.error('[capi]', e)));

    // Refresh cached product pages so stock labels catch up.
    const { data: order } = await admin.from('orders').select('id').eq('public_ref', row.public_ref).single<{ id: string }>();
    const { data: slugs } = order
      ? await admin.from('order_items').select('product:products(slug)').eq('order_id', order.id)
      : { data: null };
    for (const s of (slugs as unknown as { product: { slug: string } | null }[] | null) ?? []) {
      if (s.product?.slug) revalidatePath(`/product/${s.product.slug}`);
    }
  }

  // Lets this browser (and only this one) see the full confirmation.
  (await cookies()).set(LAST_ORDER_COOKIE, row.public_ref, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/order',
    maxAge: 60 * 60 * 24,
  });
  redirect(payUrl ?? `/order/${row.public_ref}`);
}

// --------------------------------------------------------------- tracking

export type TrackState = ActionState & { result?: TrackResult };

export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const raw = formToObject(formData);
  const values = { ref: String(raw.ref ?? '').slice(0, 30), phoneLast4: String(raw.phoneLast4 ?? '').slice(0, 4) };
  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values };

  if (!(await hit('track:ip', await clientIp(), LIMITS.trackIp))) {
    return { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.', values };
  }

  const { data, error } = await createAdminClient().rpc('track_order', {
    p_ref: parsed.data.ref,
    p_phone_last4: parsed.data.phoneLast4,
  });
  if (error) {
    console.error('[track]', error);
    return { ok: false, message: 'Something went wrong. Please try again.', values };
  }
  if (!data) {
    // Same message whichever field was wrong.
    return { ok: false, message: 'We could not find an order with that reference and phone number.', values };
  }
  return { ok: true, result: data as TrackResult, values };
}
