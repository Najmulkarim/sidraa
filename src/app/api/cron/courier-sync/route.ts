import { NextResponse, type NextRequest } from 'next/server';
import { readCourierSettings } from '@/lib/courier/config';
import { syncParcel } from '@/lib/courier/sync';
import type { CourierName } from '@/lib/courier/types';
import { safeEqual } from '@/lib/secure-compare';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Safety net for missed webhooks: asks the courier about parcels that have
 * not been checked for 30 minutes. vercel.json runs it on a schedule; Vercel
 * sends "Authorization: Bearer $CRON_SECRET". Any other scheduler can call
 * it the same way.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await readCourierSettings();
  if (!settings.auto_sync) return NextResponse.json({ skipped: 'auto sync is off' });

  const { data, error } = await createAdminClient().rpc('courier_sync_queue', { p_limit: 40 });
  if (error) {
    console.error('[cron] courier queue', error);
    return NextResponse.json({ error: 'queue' }, { status: 500 });
  }
  const started = Date.now();
  let checked = 0;
  let moved = 0;
  const errors: string[] = [];
  for (const p of (data ?? []) as { id: string; courier: CourierName; consignment_id: string }[]) {
    if (Date.now() - started > 45_000) break;
    try {
      const r = await syncParcel(settings, p.courier, p.consignment_id);
      checked++;
      if (r.status && r.status !== 'shipped') moved++;
    } catch (e) {
      errors.push(`${p.courier} ${p.consignment_id}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }
  if (errors.length) console.warn('[cron] courier sync', errors.slice(0, 5));
  return NextResponse.json({ checked, moved, failed: errors.length });
}
