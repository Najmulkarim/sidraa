'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { normalizeBdPhone } from '@/lib/phone';
import { fillTemplate, readSmsSettings, sendSms } from '@/lib/sms';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/types';

const schema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['bulksmsbd', 'smsnetbd']),
  apiKey: z.string().trim().max(300),
  removeKey: z.boolean(),
  senderId: z.string().trim().max(40),
  orderText: z.string().trim().min(1, 'Write the message').max(480, 'At most 480 characters'),
});

/** Settings → SMS. The key is never sent back to the browser: empty keeps the saved one. */
export async function saveSmsSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission('store_settings');
  const parsed = schema.safeParse({
    enabled: fd.get('enabled') === 'on',
    provider: fd.get('provider'),
    apiKey: String(fd.get('apiKey') ?? ''),
    removeKey: fd.get('removeKey') === 'on',
    senderId: String(fd.get('senderId') ?? ''),
    orderText: String(fd.get('orderText') ?? ''),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the fields.' };
  const s = parsed.data;
  const admin = createAdminClient();
  const cur = await readSmsSettings();
  if (!cur) return { ok: false, message: 'Run the latest database update (0046) in Supabase.' };
  const apiKey = s.removeKey ? null : s.apiKey || cur.api_key;
  if (s.enabled && !apiKey) return { ok: false, message: 'Add the API key from your SMS company before switching SMS on.' };
  const { error } = await admin.from('sms_settings').update({
    enabled: s.enabled, provider: s.provider, api_key: apiKey, sender_id: s.senderId || null, order_text: s.orderText, updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) return { ok: false, message: 'Could not save. Please try again.' };
  revalidatePath('/admin/settings');
  return { ok: true, message: s.enabled ? 'SMS settings saved — customers get an SMS when they order.' : 'SMS settings saved (SMS is off).' };
}

/** "Send a test SMS" with the saved settings, to any number. */
export async function sendTestSms(phone: string): Promise<ActionState> {
  await requirePermission('store_settings');
  const to = normalizeBdPhone(phone);
  if (!to) return { ok: false, message: 'Enter a mobile number like 01XXXXXXXXX.' };
  const s = await readSmsSettings();
  if (!s) return { ok: false, message: 'Run the latest database update (0046) in Supabase.' };
  if (!s.api_key) return { ok: false, message: 'Save the API key first.' };
  const message = fillTemplate(s.order_text, { name: 'Customer', order: 'TEST-0001', total: '1,250', store: 'our shop', track: 'sidraabd.com/track' });
  const r = await sendSms(s, to, message);
  await createAdminClient().from('sms_log').insert({ phone: to, kind: 'test', ok: r.ok, detail: r.detail });
  return { ok: r.ok, message: r.ok ? `Test SMS sent to ${to}.` : `Not sent — ${r.detail}` };
}
