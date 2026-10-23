import 'server-only';
import { SITE_URL } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashedUserData } from './hash';

/**
 * Server-side Purchase event (Facebook Conversions API). Runs after the
 * customer has been redirected (next/server after()), so a slow or failing
 * Graph API never delays checkout. Uses the same event_id as the browser
 * Pixel (the order reference) so Meta counts the purchase once.
 * Every attempt is written to capi_events (Settings → Facebook shows it).
 */
export type PurchaseContext = { publicRef: string; ip: string | null; userAgent: string | null; fbp: string | null; fbc: string | null };

type MarketingRow = { capi_enabled: boolean; capi_token: string | null; capi_test_code: string | null; graph_version: string };

export async function sendPurchaseEvent(ctx: PurchaseContext): Promise<void> {
  const admin = createAdminClient();
  const [{ data: m }, { data: s }] = await Promise.all([
    admin.from('marketing_settings').select('capi_enabled, capi_token, capi_test_code, graph_version').eq('id', 1).single<MarketingRow>(),
    admin.from('store_settings').select('fb_pixel_id').eq('id', 1).single<{ fb_pixel_id: string | null }>(),
  ]);
  if (!m?.capi_enabled || !m.capi_token || !s?.fb_pixel_id) return;

  const { data: order } = await admin
    .from('orders')
    .select('id, public_ref, customer_name, customer_phone, district, total, created_at, items:order_items(product_id, quantity, unit_price)')
    .eq('public_ref', ctx.publicRef)
    .single<{
      id: string; public_ref: string; customer_name: string; customer_phone: string; district: string; total: number | string; created_at: string;
      items: { product_id: string | null; quantity: number; unit_price: number | string }[];
    }>();
  if (!order) return;

  const contents = order.items.filter((i) => i.product_id).map((i) => ({ id: i.product_id as string, quantity: i.quantity, item_price: Number(i.unit_price) }));
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(new Date(order.created_at).getTime() / 1000),
    event_id: order.public_ref,
    action_source: 'website',
    event_source_url: `${SITE_URL}/checkout`,
    user_data: {
      ...hashedUserData({ phone: order.customer_phone, name: order.customer_name, district: order.district }),
      ...(ctx.ip ? { client_ip_address: ctx.ip } : {}),
      ...(ctx.userAgent ? { client_user_agent: ctx.userAgent.slice(0, 400) } : {}),
      ...(ctx.fbp ? { fbp: ctx.fbp } : {}),
      ...(ctx.fbc ? { fbc: ctx.fbc } : {}),
    },
    custom_data: {
      currency: 'BDT',
      value: Number(order.total),
      order_id: order.public_ref,
      content_type: 'product',
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((n, c) => n + c.quantity, 0),
    },
  };

  let ok = false;
  let response = '';
  try {
    const res = await fetch(`https://graph.facebook.com/${m.graph_version}/${s.fb_pixel_id}/events?access_token=${encodeURIComponent(m.capi_token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], ...(m.capi_test_code ? { test_event_code: m.capi_test_code } : {}) }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    response = (await res.text()).slice(0, 1000);
    ok = res.ok;
  } catch (e) {
    response = e instanceof Error ? e.message : 'request failed';
  }
  // The token is in the URL only; never in what we store.
  await admin.from('capi_events').insert({ order_id: order.id, event_name: 'Purchase', event_id: order.public_ref, ok, response });
  if (!ok) console.warn('[capi] Purchase not accepted', order.public_ref, response.slice(0, 200));
}
