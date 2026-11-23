import { describe, expect, it } from 'vitest';
import { DISTRICTS } from '@/components/admin/DistrictList';
import { zoneForDistrict } from '@/lib/delivery';

const zones = [
  { id: 'in', name: 'Inside Dhaka', is_active: true },
  { id: 'sub', name: 'Dhaka suburbs', is_active: true },
  { id: 'out', name: 'Outside Dhaka', is_active: true },
];

describe('zoneForDistrict', () => {
  it('Dhaka goes Inside Dhaka', () => {
    expect(zoneForDistrict('Dhaka', zones, DISTRICTS, 'out')).toBe('in');
  });

  it('keeps Dhaka suburbs when it was chosen for a Dhaka address', () => {
    expect(zoneForDistrict('dhaka', zones, DISTRICTS, 'sub')).toBeNull();
  });

  it('any other district goes Outside Dhaka', () => {
    expect(zoneForDistrict('Dinajpur', zones, DISTRICTS, 'in')).toBe('out');
    expect(zoneForDistrict('Chittagong', zones, DISTRICTS, 'in')).toBe('out');
  });

  it('leaves the area alone while typing or for an unknown name', () => {
    expect(zoneForDistrict('Dina', zones, DISTRICTS, 'in')).toBeNull();
    expect(zoneForDistrict('', zones, DISTRICTS, 'in')).toBeNull();
  });

  it('does nothing when the shop has no such area', () => {
    expect(zoneForDistrict('Dinajpur', [{ id: 'all', name: 'All Bangladesh', is_active: true }], DISTRICTS)).toBeNull();
  });
});
