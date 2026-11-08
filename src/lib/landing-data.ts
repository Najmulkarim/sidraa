import 'server-only';
import { cache } from 'react';
import { createAdminClient } from './supabase/admin';
import { createPublicClient } from './supabase/public';
import { getProductBySlug } from './catalog';
import { toNumber } from './format';
import { LANDING_SELECT, toLandingPage, type CouponOffer } from './landing';

/** An active landing page and its (published) product, or null. */
export const getLandingPage = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return null;
  const db = createPublicClient();
  const { data, error } = await db.from('landing_pages').select(LANDING_SELECT).eq('slug', slug).eq('is_active', true).maybeSingle();
  if (error) console.error('[landing]', error.message);
  if (!data) return null;
  const page = toLandingPage(data as Record<string, unknown>);
  const { data: p } = await db.from('products').select('slug').eq('id', page.product_id).maybeSingle<{ slug: string }>();
  const product = p ? await getProductBySlug(p.slug) : null;
  if (!product) return null;
  return { page, product, coupon: page.coupon_code ? await liveCoupon(page.coupon_code) : null };
});

/** The page's coupon, only while it can really be used (on, started, not ended, not used up). */
async function liveCoupon(code: string): Promise<CouponOffer | null> {
  const { data: settings } = await createAdminClient().from('store_settings').select('coupons_enabled').eq('id', 1).maybeSingle<{ coupons_enabled: boolean }>();
  if (settings && !settings.coupons_enabled) return null;
  const { data } = await createAdminClient()
    .from('coupons')
    .select('code, kind, value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, used_count, is_active')
    .eq('code', code)
    .maybeSingle<{ code: string; kind: 'percent' | 'fixed'; value: number | string; min_subtotal: number | string; max_discount: number | string | null; starts_at: string | null; ends_at: string | null; usage_limit: number | null; used_count: number; is_active: boolean }>();
  if (!data || !data.is_active) return null;
  const now = Date.now();
  if (data.starts_at && Date.parse(data.starts_at) > now) return null;
  if (data.ends_at && Date.parse(data.ends_at) <= now) return null;
  if (data.usage_limit !== null && data.used_count >= data.usage_limit) return null;
  return {
    code: data.code,
    kind: data.kind,
    value: toNumber(data.value),
    min_subtotal: toNumber(data.min_subtotal),
    max_discount: data.max_discount === null ? null : toNumber(data.max_discount),
    ends_at: data.ends_at,
  };
}
