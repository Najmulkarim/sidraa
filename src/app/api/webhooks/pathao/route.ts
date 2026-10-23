import { NextResponse, type NextRequest } from 'next/server';
import { readCourierSettings } from '@/lib/courier/config';
import { applyCourierStatus } from '@/lib/courier/sync';
import { safeEqual } from '@/lib/secure-compare';

/**
 * Pathao merchant webhook. In the Pathao merchant panel (Developers →
 * Webhooks) add https://<your-domain>/api/webhooks/pathao with a secret;
 * save the same secret in Settings → Courier → "Webhook secret", and the
 * "integration secret" Pathao shows there. Pathao sends the secret in the
 * X-PATHAO-Signature header and expects HTTP 202 with the integration secret
 * in X-Pathao-Merchant-Webhook-Integration-Secret.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = await readCourierSettings();
  const signature = req.headers.get('x-pathao-signature');
  if (!settings.pathao_webhook_secret || !safeEqual(signature, settings.pathao_webhook_secret)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const reply = (body: Record<string, unknown>, status = 202) =>
    NextResponse.json(body, {
      status,
      headers: settings.pathao_integration_secret ? { 'X-Pathao-Merchant-Webhook-Integration-Secret': settings.pathao_integration_secret } : undefined,
    });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply({ message: 'Invalid JSON' }, 400);
  }

  const consignment = body.consignment_id ? String(body.consignment_id) : '';
  const status =
    typeof body.order_status_slug === 'string' ? body.order_status_slug
    : typeof body.order_status === 'string' ? body.order_status
    : typeof body.event === 'string' ? body.event
    : '';
  // The integration check and events without a parcel only need the 202.
  if (!consignment || !status) return reply({ message: 'OK' });
  const fee = body.delivery_fee ?? body.collected_delivery_fee;
  const charge = fee === undefined || fee === null ? null : Number(fee);

  try {
    await applyCourierStatus('pathao', consignment.slice(0, 60), status, charge);
    return reply({ message: 'OK' });
  } catch (e) {
    console.error('[webhook] pathao', e);
    return reply({ message: 'Could not save' }, 500);
  }
}
