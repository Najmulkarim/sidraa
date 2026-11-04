import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * SMS to customers through a Bangladeshi SMS company (Settings → SMS).
 *  - BulkSMSBD  (bulksmsbd.net): POST https://bulksmsbd.net/api/smsapi
 *      form: api_key, senderid, number, message → JSON with response_code 202 = sent
 *  - SMS.net.bd / Alpha SMS: POST https://api.sms.net.bd/sendsms
 *      form: api_key, msg, to, sender_id (optional) → JSON with error 0 = sent
 */
export type SmsProvider = 'bulksmsbd' | 'smsnetbd';
export const SMS_PROVIDERS: Record<SmsProvider, { name: string; site: string }> = {
  bulksmsbd: { name: 'BulkSMSBD', site: 'https://bulksmsbd.net' },
  smsnetbd: { name: 'SMS.net.bd (Alpha SMS)', site: 'https://sms.net.bd' },
};

export type SmsSettings = { enabled: boolean; provider: SmsProvider; api_key: string | null; sender_id: string | null; order_text: string };

export async function readSmsSettings(): Promise<SmsSettings | null> {
  const { data, error } = await createAdminClient().from('sms_settings').select('enabled, provider, api_key, sender_id, order_text').eq('id', 1).maybeSingle<SmsSettings>();
  if (error) return null;
  return data;
}

/** "{name}", "{order}"… filled in; unknown words left as they are. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m).replace(/\s+/g, ' ').trim();
}

/** 01711222333 → 8801711222333 (both companies take this form). */
const intl = (phone: string) => (phone.startsWith('880') ? phone : `88${phone}`);

export async function sendSms(s: Pick<SmsSettings, 'provider' | 'api_key' | 'sender_id'>, phone: string, message: string): Promise<{ ok: boolean; detail: string }> {
  if (!s.api_key) return { ok: false, detail: 'No API key saved' };
  try {
    if (s.provider === 'bulksmsbd') {
      const body = new URLSearchParams({ api_key: s.api_key, senderid: s.sender_id ?? '', number: intl(phone), message });
      const res = await fetch('https://bulksmsbd.net/api/smsapi', { method: 'POST', body, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
      const text = await res.text();
      let code: unknown;
      let msg = '';
      try { const j = JSON.parse(text) as { response_code?: unknown; success_message?: string; error_message?: string }; code = j.response_code; msg = j.success_message || j.error_message || ''; } catch { code = text.trim(); }
      const ok = String(code) === '202';
      return { ok, detail: ok ? 'Sent' : `BulkSMSBD ${String(code)}${msg ? `: ${msg}` : ''}`.slice(0, 300) };
    }
    const body = new URLSearchParams({ api_key: s.api_key, msg: message, to: intl(phone) });
    if (s.sender_id) body.set('sender_id', s.sender_id);
    const res = await fetch('https://api.sms.net.bd/sendsms', { method: 'POST', body, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    const j = (await res.json().catch(() => null)) as { error?: number; msg?: string } | null;
    const ok = j?.error === 0;
    return { ok, detail: ok ? 'Sent' : `SMS.net.bd ${j?.error ?? res.status}${j?.msg ? `: ${j.msg}` : ''}`.slice(0, 300) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error && e.name === 'TimeoutError' ? 'The SMS company did not answer' : 'Could not reach the SMS company' };
  }
}

/** After an order is placed: the "order placed" SMS, if SMS is switched on. Logged either way. */
export async function sendOrderPlacedSms(order: { id: string; publicRef: string; name: string; phone: string; total: number }, store: { name: string; siteUrl: string }) {
  const s = await readSmsSettings();
  if (!s?.enabled || !s.api_key) return;
  const message = fillTemplate(s.order_text, {
    name: order.name.split(/\s+/)[0] ?? order.name,
    order: order.publicRef,
    total: Math.round(order.total).toLocaleString('en-US'),
    store: store.name,
    track: `${store.siteUrl.replace(/^https?:\/\//, '')}/track`,
  });
  const r = await sendSms(s, order.phone, message);
  if (!r.ok) console.error('[sms] order', order.publicRef, r.detail);
  await createAdminClient().from('sms_log').insert({ order_id: order.id, phone: order.phone, kind: 'order_placed', ok: r.ok, detail: r.detail });
}
