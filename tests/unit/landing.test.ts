import { describe, expect, it } from 'vitest';
import { couponSaving, couponWords, landingSchema, parseFaqs, videoEmbed, type CouponOffer } from '@/lib/landing';

describe('videoEmbed', () => {
  it('turns YouTube links into a privacy embed', () => {
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
    expect(videoEmbed('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  });
  it('embeds Facebook videos through the video plugin', () => {
    expect(videoEmbed('https://www.facebook.com/sidraa/videos/123456789')).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=/);
  });
  it('refuses anything else', () => {
    expect(videoEmbed('javascript:alert(1)')).toBeNull();
    expect(videoEmbed('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbed('not a link')).toBeNull();
  });
});

describe('couponSaving', () => {
  const c = (o: Partial<CouponOffer>): CouponOffer => ({ code: 'EID', kind: 'percent', value: 10, min_subtotal: 0, max_discount: null, ends_at: null, ...o });
  it('works like quote_order', () => {
    expect(couponSaving(1250, c({}))).toBe(125);
    expect(couponSaving(1255, c({}))).toBe(126);
    expect(couponSaving(1000, c({ max_discount: 50 }))).toBe(50);
    expect(couponSaving(1000, c({ kind: 'fixed', value: 150 }))).toBe(150);
    expect(couponSaving(100, c({ kind: 'fixed', value: 150 }))).toBe(100);
    expect(couponSaving(500, c({ min_subtotal: 800 }))).toBe(0);
    expect(couponSaving(500, null)).toBe(0);
  });
  it('words', () => {
    expect(couponWords(c({}))).toBe('10% off');
    expect(couponWords(c({ kind: 'fixed', value: 1500 }))).toBe('৳1,500 off');
  });
});

describe('landing form', () => {
  const base = { slug: 'eid-abaya', productId: '3f2b8a1e-6c1d-4f7a-9b2e-1a2b3c4d5e6f', isActive: true, headline: '', subheadline: '', offerText: '', couponCode: '', videoUrl: '', benefits: ['Soft', ''], faqs: [{ q: 'Q', a: '' }, { q: 'Size?', a: 'M-XXL' }], buttonText: '', showDescription: true, showReviews: true };
  it('cleans empty fields, points and questions', () => {
    const r = landingSchema.parse(base);
    expect(r.headline).toBeNull();
    expect(r.couponCode).toBeNull();
    expect(r.benefits).toEqual(['Soft']);
    expect(r.faqs).toEqual([{ q: 'Size?', a: 'M-XXL' }]);
  });
  it('checks the link and the video', () => {
    expect(landingSchema.safeParse({ ...base, slug: 'Eid Abaya!' }).success).toBe(false);
    expect(landingSchema.safeParse({ ...base, videoUrl: 'https://example.com/v' }).success).toBe(false);
    expect(landingSchema.parse({ ...base, couponCode: 'eid10' }).couponCode).toBe('EID10');
  });
  it('reads stored questions safely', () => {
    expect(parseFaqs([{ q: 'a', a: 'b' }, { q: 1 }, null, 'x'])).toEqual([{ q: 'a', a: 'b' }]);
    expect(parseFaqs('nope')).toEqual([]);
  });
});
