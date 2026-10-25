import { describe, expect, it } from 'vitest';
import { parseDescription, splitBullet, whatsappOrderLink } from '@/lib/product-content';

describe('parseDescription', () => {
  it('splits bullets, label: value lines and free text', () => {
    const r = parseDescription('Light and strong.\n\n- UV400 lenses\n• Comes with a case\nMaterial: Metal\nFrame width: 140 mm\nSee https://example.com for care.');
    expect(r.bullets).toEqual(['UV400 lenses', 'Comes with a case']);
    expect(r.specs).toEqual([['Material', 'Metal'], ['Frame width', '140 mm']]);
    expect(r.text).toBe('Light and strong.\n\nSee https://example.com for care.');
  });
  it('keeps plain paragraphs, URLs and times as text', () => {
    const r = parseDescription('Visit https://x.com\nOpens at 10:30 daily\nA simple line');
    expect(r.bullets).toEqual([]);
    expect(r.specs).toEqual([]);
    expect(r.text).toContain('https://x.com');
  });
  it('reads emoji checklists and skips their heading', () => {
    const r = parseDescription('✅ Main Features:\n\n✔️ Rimless Geometric Design – Modern styling\n✔Premium Metal Frame – Durable\n-5% off this week');
    expect(r.bullets).toEqual(['Rimless Geometric Design – Modern styling', 'Premium Metal Frame – Durable']);
    expect(r.text).toBe('-5% off this week');
  });
  it('splits a bullet into its bold lead and the rest', () => {
    expect(splitBullet('Premium Metal Frame – Sleek and durable')).toEqual(['Premium Metal Frame', 'Sleek and durable']);
    expect(splitBullet('Comes with a case')).toEqual([null, 'Comes with a case']);
  });
  it('handles an empty description', () => {
    expect(parseDescription(null)).toEqual({ bullets: [], specs: [], text: '' });
  });
});

describe('whatsappOrderLink', () => {
  it('builds a wa.me link for a BD mobile and refuses anything else', () => {
    expect(whatsappOrderLink('01711-222333', 'Hi there')).toBe('https://wa.me/8801711222333?text=Hi%20there');
    expect(whatsappOrderLink('+8801711222333', 'x')).toBe('https://wa.me/8801711222333?text=x');
    expect(whatsappOrderLink('12345', 'x')).toBeNull();
    expect(whatsappOrderLink(null, 'x')).toBeNull();
  });
});
