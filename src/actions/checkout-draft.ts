'use server';

import { z } from 'zod';
import { normalizeBdPhone } from '@/lib/phone';
import { clientIp, hit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const draftSchema = z.object({
  key: z.uuid(),
  customerPhone: z.string().max(20),
  customerName: text(120),
  address: text(500),
  district: text(80),
  area: text(80),
  note: text(500),
  zoneId: z.preprocess((v) => (v === '' ? undefined : v), z.uuid().optional()),
  items: z.array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
});

// Typing saves every second or two; this is plenty for real customers and stops floods.
const DRAFT_LIMIT = { max: 60, windowSeconds: 600 };

/**
 * Checkout, before the order is placed: once the mobile number is valid, what the
 * customer has entered so far is kept as an "incomplete order" for staff to follow up.
 * One per checkout visit (its key); a return visit with the same number within a day
 * updates that one instead of adding another. Never blocks or slows the checkout.
 */
export async function saveCheckoutDraft(input: unknown): Promise<{ ok: boolean }> {
  try {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const d = parsed.data;
    const phone = normalizeBdPhone(d.customerPhone);
    if (!phone) return { ok: false };
    if (!(await hit('draft:ip', await clientIp(), DRAFT_LIMIT))) return { ok: false };

    const admin = createAdminClient();
    const row = {
      customer_phone: phone,
      customer_name: d.customerName,
      address: d.address,
      district: d.district,
      area: d.area,
      note: d.note,
      zone_id: d.zoneId ?? null,
      items: d.items,
      updated_at: new Date().toISOString(),
    };

    // This visit's draft, or the same number's open draft from the last day.
    const { data: mine } = await admin.from('incomplete_orders').select('id, status').eq('draft_key', d.key).maybeSingle<{ id: string; status: string }>();
    if (mine) {
      if (mine.status !== 'open') return { ok: true }; // already ordered or closed by staff
      const { error } = await admin.from('incomplete_orders').update(row).eq('id', mine.id);
      return { ok: !error };
    }
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await admin
      .from('incomplete_orders')
      .select('id')
      .eq('customer_phone', phone)
      .eq('status', 'open')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    const { error } = recent
      ? await admin.from('incomplete_orders').update({ ...row, draft_key: d.key }).eq('id', recent.id)
      : await admin.from('incomplete_orders').insert({ ...row, draft_key: d.key });
    if (error) console.error('[checkout] draft', error.message);
    return { ok: !error };
  } catch (e) {
    console.error('[checkout] draft', e);
    return { ok: false };
  }
}
