import { describe, expect, it } from 'vitest';
import { parseStory, storagePath, storyFromProduct } from '@/lib/story';
import { landingSchema, toLandingPage } from '@/lib/landing';

describe('story template', () => {
  it('reads anything safely', () => {
    const s = parseStory({ title: 7, blocks: [{ title: 'A', points: [{ mark: '✔', text: 'x' }, 'bad'] }, null], images: ['a', '', 5] });
    expect(s.title).toBe('');
    expect(s.blocks[0]!.title).toBe('A');
    expect(s.images).toEqual(['a']);
    expect(s.contact.on).toBe(true);
  });
  it('finds our own photos in description links', () => {
    expect(storagePath('https://x.supabase.co/storage/v1/object/public/product-images/products/p1/a%20b.jpg')).toBe('products/p1/a b.jpg');
    expect(storagePath('https://other.site/pic.jpg')).toBeNull();
  });
  it('is filled from the product', () => {
    const s = storyFromProduct({ name: 'Ghee', intro: 'Made at home.', bullets: ['Pure: no colour', 'Fresh'], posters: ['p1', 'p2'], photos: ['a', 'b'] });
    expect(s.title).toBe('Ghee');
    expect(s.blocks.map((b) => b.title)).toEqual(['পণ্যের পরিচিতি', 'বৈশিষ্ট্য']);
    expect(s.blocks[1]!.points).toEqual([{ mark: '✔', text: 'Pure: no colour' }, { mark: '✔', text: 'Fresh' }]);
    expect(s.images).toEqual(['p1', 'p2']);
    expect(storyFromProduct({ name: 'X', intro: '', bullets: [], posters: [], photos: ['a', 'b', 'c'] }).images).toEqual(['b', 'c']);
  });
  it('a stored page knows its design', () => {
    const page = toLandingPage({ template: 'story', sections: { title: 'T' }, benefits: null, faqs: [] });
    expect(page.template).toBe('story');
    expect(page.story.title).toBe('T');
    expect(toLandingPage({ template: 'weird' }).template).toBe('classic');
    expect(landingSchema.shape.template.parse('story')).toBe('story');
  });
});
