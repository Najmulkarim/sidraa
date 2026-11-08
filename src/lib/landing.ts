/**
 * Landing pages (/offer/<slug>): one product, its own headline, video,
 * points and FAQ, and an order form on the page. Pure helpers — tested in
 * tests/unit/landing.test.ts.
 */
import { z } from 'zod';
import { SLUG_RE } from './slug';

export type Faq = { q: string; a: string };

export type LandingPage = {
  id: string;
  slug: string;
  product_id: string;
  is_active: boolean;
  headline: string | null;
  subheadline: string | null;
  offer_text: string | null;
  coupon_code: string | null;
  video_url: string | null;
  benefits: string[];
  faqs: Faq[];
  button_text: string | null;
  show_description: boolean;
  show_reviews: boolean;
  updated_at?: string;
};

export const LANDING_SELECT = 'id, slug, product_id, is_active, headline, subheadline, offer_text, coupon_code, video_url, benefits, faqs, button_text, show_description, show_reviews, updated_at';

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

export const landingSchema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Use lowercase English letters, numbers and dashes').max(60),
  productId: z.uuid('Choose a product'),
  isActive: z.boolean(),
  headline: text(160),
  subheadline: text(400),
  offerText: text(120),
  couponCode: z.string().trim().toUpperCase().max(24).transform((v) => v || null).refine((v) => v === null || /^[A-Z0-9_-]{3,24}$/.test(v), 'Not a coupon code'),
  videoUrl: text(300).refine((v) => v === null || videoEmbed(v) !== null, 'Paste a YouTube or Facebook video link'),
  benefits: z.array(z.string().trim().max(200)).max(12, 'At most 12 points').transform((xs) => xs.filter(Boolean)),
  faqs: z.array(z.object({ q: z.string().trim().max(200), a: z.string().trim().max(1000) })).max(12, 'At most 12 questions').transform((xs) => xs.filter((f) => f.q && f.a)),
  buttonText: text(40),
  showDescription: z.boolean(),
  showReviews: z.boolean(),
});
export type LandingInput = z.input<typeof landingSchema>;

/** A pasted YouTube or Facebook video link → the address to embed, else null. */
export function videoEmbed(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : null);
  let yt: string | null = null;
  if (host === 'youtu.be') yt = id(u.pathname.split('/')[1]);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') yt = id(u.searchParams.get('v'));
    else {
      const m = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname);
      yt = id(m?.[1]);
    }
  }
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0`;
  if (host === 'facebook.com' || host === 'fb.watch') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false`;
  }
  return null;
}

/** The FAQ list as stored (jsonb), cleaned. */
export function parseFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({ q: typeof f.q === 'string' ? f.q : '', a: typeof f.a === 'string' ? f.a : '' }))
    .filter((f) => f.q && f.a)
    .slice(0, 12);
}

export type CouponOffer = { code: string; kind: 'percent' | 'fixed'; value: number; min_subtotal: number; max_discount: number | null; ends_at: string | null };

/** What the coupon takes off one piece at `price` (0 when the order is too small for it). Mirrors quote_order(). */
export function couponSaving(price: number, c: CouponOffer | null): number {
  if (!c || price < c.min_subtotal) return 0;
  let d = c.kind === 'percent' ? Math.round((price * c.value) / 100) : c.value;
  if (c.max_discount !== null) d = Math.min(d, c.max_discount);
  return Math.max(0, Math.min(price, d));
}

/** Short words for the coupon, e.g. "10% off" or "৳100 off". */
export function couponWords(c: CouponOffer): string {
  return c.kind === 'percent' ? `${c.value}% off` : `৳${c.value.toLocaleString('en-IN')} off`;
}
