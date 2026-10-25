'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { SITE_URL } from '@/lib/env';
import { normalizeBdPhone } from '@/lib/phone';
import { bkashCreate, BkashError } from '@/lib/payments/bkash';
import { readPaymentSettings } from '@/lib/payments/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/types';
import { fieldErrors, formToObject } from '@/lib/validation';

/** Secret boxes: empty keeps the saved value, the "Remove" tick clears it. */
const secret = (fd: FormData, name: string, value: string | undefined, saved: string | null) => (fd.get(`clear_${name}`) === 'on' ? null : value?.trim() || saved);
const on = z.preprocess((v) => v === 'on' || v === 'true', z.boolean());
const opt = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined), z.string().max(max).optional());
const walletNumber = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  z.string().refine((v) => normalizeBdPhone(v) !== null, 'Enter a valid number, e.g. 01712345678').transform((v) => normalizeBdPhone(v) as string).optional(),
);
const kind = z.enum(['personal', 'agent', 'merchant']);

const schema = z.object({
  codEnabled: on,
  bkashManual: on, bkashNumber: walletNumber, bkashNumberType: kind,
  nagadManual: on, nagadNumber: walletNumber, nagadNumberType: kind,
  bkashMerchant: on, bkashSandbox: on, bkashAppKey: opt(300), bkashAppSecret: opt(300), bkashUsername: opt(300), bkashPassword: opt(300),
  nagadMerchant: on, nagadSandbox: on, nagadMerchantId: opt(100), nagadPublicKey: opt(4000), nagadPrivateKey: opt(4000),
}).superRefine((p, ctx) => {
  if (p.bkashManual && !p.bkashNumber) ctx.addIssue({ code: 'custom', path: ['bkashNumber'], message: 'Add the bKash number customers send money to' });
  if (p.nagadManual && !p.nagadNumber) ctx.addIssue({ code: 'custom', path: ['nagadNumber'], message: 'Add the Nagad number customers send money to' });
});

export async function savePaymentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission('store_settings');
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;
  const saved = await readPaymentSettings();
  const row = {
    cod_enabled: p.codEnabled,
    bkash_manual: p.bkashManual, bkash_number: p.bkashNumber ?? null, bkash_number_type: p.bkashNumberType,
    nagad_manual: p.nagadManual, nagad_number: p.nagadNumber ?? null, nagad_number_type: p.nagadNumberType,
    bkash_merchant: p.bkashMerchant, bkash_sandbox: p.bkashSandbox,
    bkash_app_key: secret(formData, 'bkashAppKey', p.bkashAppKey, saved.bkash_app_key),
    bkash_app_secret: secret(formData, 'bkashAppSecret', p.bkashAppSecret, saved.bkash_app_secret),
    bkash_username: p.bkashUsername ?? null,
    bkash_password: secret(formData, 'bkashPassword', p.bkashPassword, saved.bkash_password),
    nagad_merchant: p.nagadMerchant, nagad_sandbox: p.nagadSandbox,
    nagad_merchant_id: p.nagadMerchantId ?? null,
    nagad_public_key: secret(formData, 'nagadPublicKey', p.nagadPublicKey, saved.nagad_public_key),
    nagad_private_key: secret(formData, 'nagadPrivateKey', p.nagadPrivateKey, saved.nagad_private_key),
  };
  if (!row.cod_enabled && !(row.bkash_manual || row.nagad_manual || row.bkash_merchant)) {
    return { ok: false, message: 'Keep at least one way to pay switched on (cash on delivery, bKash or Nagad).' };
  }
  const { error } = await createAdminClient().from('payment_settings').update(row).eq('id', 1);
  if (error) {
    console.error('[admin] payment settings', error);
    return { ok: false, message: 'Could not save. Run the latest database update (0021) in Supabase, then try again.' };
  }
  revalidatePath('/admin/settings');
  revalidatePath('/checkout');
  return { ok: true, message: 'Payment settings saved. Checkout shows them now.' };
}

/** "Test bKash": logs in and opens a ৳1 payment (never charged — nobody completes it). */
export async function testBkash(): Promise<ActionState> {
  await requirePermission('store_settings');
  try {
    await bkashCreate(await readPaymentSettings(), { amount: 1, invoice: `TEST${Date.now()}`, payer: '01700000000', callbackURL: `${SITE_URL}/api/pay/bkash/callback` });
    return { ok: true, message: 'bKash connected — the credentials work.' };
  } catch (e) {
    return { ok: false, message: e instanceof BkashError ? e.message : 'Could not reach bKash.' };
  }
}

/** Staff check a manual bKash/Nagad payment: received (order counts as paid) or not received. */
export async function verifyPayment(orderId: string, received: boolean): Promise<ActionState> {
  const { user } = await requirePermission('orders_edit');
  if (!z.uuid().safeParse(orderId).success) return { ok: false, message: 'Invalid order.' };
  const admin = createAdminClient();
  const { data: o } = await admin.from('orders').select('id, total, payment_method, payment_trx_id, payment_status').eq('id', orderId).maybeSingle<{ id: string; total: number | string; payment_method: string; payment_trx_id: string | null; payment_status: string }>();
  if (!o || o.payment_method === 'cod') return { ok: false, message: 'This order has no online payment.' };
  const { error } = await admin
    .from('orders')
    .update(received ? { payment_status: 'paid', paid_amount: Number(o.total) } : { payment_status: 'failed', paid_amount: 0 })
    .eq('id', o.id);
  if (error) return { ok: false, message: 'Could not update the payment.' };
  const wallet = o.payment_method === 'bkash' ? 'bKash' : 'Nagad';
  await admin.from('order_notes').insert({
    order_id: o.id, kind: 'system', created_by: user.id,
    body: received ? `${wallet} payment checked and received (TrxID ${o.payment_trx_id ?? '—'}).` : `${wallet} payment NOT received (TrxID ${o.payment_trx_id ?? '—'}). Collect cash on delivery.`,
  });
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${o.id}`);
  return { ok: true, message: received ? 'Marked as paid.' : 'Marked as not received — collect cash on delivery.' };
}
