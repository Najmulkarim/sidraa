import { describe, expect, it } from 'vitest';
import { freeDelivery } from '@/lib/delivery';

const z = (name: string, free_over: number | null, is_active = true) => ({ name, free_over, is_active });

describe('free delivery wording', () => {
  it('names the areas when only some get free delivery', () => {
    expect(freeDelivery([z('Inside Dhaka', 3000), z('Dhaka suburbs', 3000), z('Outside Dhaka', null)])?.text).toBe('on orders over ৳3,000 (Inside Dhaka & Dhaka suburbs)');
  });
  it('makes no area note when every active area is free', () => {
    expect(freeDelivery([z('Inside Dhaka', 3000), z('Outside Dhaka', 5000), z('Old zone', null, false)])?.text).toBe('on orders over ৳3,000');
  });
  it('says "selected areas" for three or more, and nothing when none are free', () => {
    expect(freeDelivery([z('A', 1000), z('B', 1000), z('C', 1000), z('D', null)])?.where).toBe('selected areas');
    expect(freeDelivery([z('A', null)])).toBeNull();
  });
});
