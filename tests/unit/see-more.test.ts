import { describe, expect, it } from 'vitest';
import { hasMoreAfter, parseDescription } from '@/lib/product-content';

describe('hasMoreAfter', () => {
  it('folds a picture that follows the first four points', () => {
    const c = parseDescription('- a\n- b\n- c\n- d\n![x](https://e.com/x.jpg)');
    expect(hasMoreAfter(c.flow, 4)).toBe(true);
  });
  it('folds a fifth point', () => {
    expect(hasMoreAfter(parseDescription('- a\n- b\n- c\n- d\n- e').flow, 4)).toBe(true);
  });
  it('keeps four points alone open', () => {
    expect(hasMoreAfter(parseDescription('- a\n- b\n- c\n- d').flow, 4)).toBe(false);
  });
  it('folds text after fewer points, but not a description with no points', () => {
    expect(hasMoreAfter(parseDescription('- a\n- b\n\nMore words').flow, 4)).toBe(true);
    expect(hasMoreAfter(parseDescription('Just words').flow, 4)).toBe(false);
  });
});
