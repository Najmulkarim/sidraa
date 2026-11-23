import { describe, expect, it } from 'vitest';
import { DISTRICTS, matchDistricts } from '@/components/admin/DistrictList';

describe('matchDistricts', () => {
  it('lists all 64 districts (plus old spellings)', () => {
    expect(DISTRICTS.length).toBe(64 + 5);
  });

  it('shows nothing until something is typed', () => {
    expect(matchDistricts('  ')).toEqual([]);
  });

  it('suggests the full name from a few letters', () => {
    expect(matchDistricts('din')).toEqual(['Dinajpur']);
    expect(matchDistricts('NARAY')).toEqual(['Narayanganj']);
  });

  it('puts names that start with the letters first, at most 6', () => {
    const m = matchDistricts('ra');
    expect(m.length).toBeLessThanOrEqual(6);
    expect(m.slice(0, 4)).toEqual(['Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur']);
  });

  it('hides the list once the full name is there', () => {
    expect(matchDistricts('Dhaka')).toEqual([]);
  });
});
