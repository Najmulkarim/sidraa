import { describe, expect, it } from 'vitest';
import { cleanTags, countTags, tagHref, tagSlug, tagsForSlug } from '@/lib/tags';

describe('tags', () => {
  it('cleans, drops repeats and bad tags', () => {
    expect(cleanTags(' Eid  Sale , eid sale, Best seller,, {x}, "q"')).toEqual(['Eid Sale', 'Best seller']);
    expect(cleanTags(['নতুন', 'New In'])).toEqual(['নতুন', 'New In']);
    expect(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
  it('makes web addresses and finds tags back', () => {
    expect(tagSlug('Eid Sale & Gift')).toBe('eid-sale-gift');
    expect(tagHref('নতুন')).toBe(`/collections/${encodeURIComponent('নতুন')}`);
    expect(tagsForSlug(['Eid Sale', 'eid sale', 'Other'], 'eid-sale')).toEqual(['Eid Sale', 'eid sale']);
    expect(tagsForSlug(['নতুন'], encodeURIComponent('নতুন'))).toEqual(['নতুন']);
  });
  it('counts tags across products', () => {
    expect(countTags([{ tags: ['A', 'b'] }, { tags: ['a'] }, { tags: null }])).toEqual([{ tag: 'A', count: 2 }, { tag: 'b', count: 1 }]);
  });
});
