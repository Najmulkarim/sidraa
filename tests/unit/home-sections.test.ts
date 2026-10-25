import { describe, expect, it } from 'vitest';
import { parseSettings, SETTINGS_SCHEMA } from '@/lib/home-sections';

describe('home section settings', () => {
  it('accepts site paths and https links, and rejects script or protocol-relative links', () => {
    const ok = SETTINGS_SCHEMA.quick_links.safeParse({ links: [{ label: 'Men', href: '/category/men' }, { label: 'FB', href: 'https://facebook.com/x' }] });
    expect(ok.success).toBe(true);
    for (const href of ['javascript:alert(1)', '//evil.com', 'http://plain.com', 'data:text/html,hi']) {
      expect(SETTINGS_SCHEMA.quick_links.safeParse({ links: [{ label: 'x', href }] }).success).toBe(false);
    }
  });
  it('only takes images from the bucket folders or site files', () => {
    expect(SETTINGS_SCHEMA.about.safeParse({ image: 'home/0b8f5a2e.jpg' }).success).toBe(true);
    expect(SETTINGS_SCHEMA.about.safeParse({ image: '/demo/promo-1.svg' }).success).toBe(true);
    expect(SETTINGS_SCHEMA.about.safeParse({ image: 'https://evil.com/a.jpg' }).success).toBe(false);
    expect(SETTINGS_SCHEMA.about.parse({ image: '' }).image).toBeNull();
  });
  it('fills defaults and falls back when stored settings are broken', () => {
    expect(parseSettings('collection', {})).toMatchObject({ source: 'featured', limit: 8, product_ids: [], image: null });
    expect(parseSettings('collection', { source: 'nonsense', limit: 999 })).toMatchObject({ source: 'featured', limit: 8 });
    expect(parseSettings('banners', { items: [{}, {}, {}, {}] }).items).toEqual([]);
  });
  it('keeps the chosen product order', () => {
    const ids = ['0b8f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b', '1b8f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'];
    expect(parseSettings('product_row', { source: 'manual', product_ids: ids }).product_ids).toEqual(ids);
  });
});
