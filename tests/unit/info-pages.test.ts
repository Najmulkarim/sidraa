import { describe, expect, it } from 'vitest';
import { defaultPageText, INFO_PAGE_KEYS, zoneLine } from '@/lib/info-pages';
import { parseStorefront } from '@/lib/storefront';

describe('footer pages', () => {
  it('has starter text for every page', () => {
    for (const key of INFO_PAGE_KEYS) expect(defaultPageText(key, { cod_terms: 'Pay cash.', return_policy_days: 1 }).length).toBeGreaterThan(20);
    expect(defaultPageText('returns', { cod_terms: '', return_policy_days: 1 })).toContain('**1 day**');
  });
  it('keeps saved pages and fills in missing ones', () => {
    const sf = parseStorefront({ pages: { privacy: { title: 'Privacy', body: 'We keep it safe.' } } });
    expect(sf.pages.privacy).toEqual({ title: 'Privacy', body: 'We keep it safe.' });
    expect(sf.pages.terms).toEqual({ title: '', body: '' });
    expect(parseStorefront({}).pages.delivery).toEqual({ title: '', body: '' });
  });
  it('writes a delivery area line', () => {
    expect(zoneLine({ name: 'Inside Dhaka', charge: 70, eta_text: '1–2 days', free_over: null })).toBe('**Inside Dhaka**: ৳70, usually 1–2 days');
  });
});
