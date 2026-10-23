import { NextResponse, type NextRequest } from 'next/server';
import { readCourierSettings } from '@/lib/courier/config';
import { applyCourierStatus } from '@/lib/courier/sync';
import { safeEqual } from '@/lib/secure-compare';

/**
 * Steadfast status webhook. In the Steadfast portal set the callback URL to
 * https://<your-domain>/api/webhooks/steadfast and the auth token to the
 * value saved in Settings → Courier → "Webhook token". Steadfast sends it
 * as "Authorization: Bearer <token>".
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = await readCourierSettings();
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!settings.steadfast_webhook_token || !safeEqual(token, settings.steadfast_webhook_token)) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  const consignment = body.consignment_id === undefined || body.consignment_id === null ? '' : String(body.consignment_id);
  const status = typeof body.status === 'string' ? body.status : typeof body.delivery_status === 'string' ? body.delivery_status : '';
  // "tracking_update" notifications carry a message but no status change.
  if (!consignment || !status || body.notification_type === 'tracking_update') {
    return NextResponse.json({ status: 'success', message: 'Ignored' });
  }
  const charge = body.delivery_charge === undefined || body.delivery_charge === null ? null : Number(body.delivery_charge);

  try {
    const r = await applyCourierStatus('steadfast', consignment.slice(0, 60), status, charge);
    return NextResponse.json({ status: 'success', message: r.found ? `Order is ${r.status}` : 'Unknown consignment' });
  } catch (e) {
    console.error('[webhook] steadfast', e);
    return NextResponse.json({ status: 'error', message: 'Could not save' }, { status: 500 });
  }
}
