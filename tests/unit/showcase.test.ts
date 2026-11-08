import { describe, expect, it } from 'vitest';
import { bulletItems, guessIcon, parseShowcase, showcaseFromProduct } from '@/lib/showcase';

describe('showcase template', () => {
  it('fills every part safely from nothing or junk', () => {
    const s = parseShowcase(null);
    expect(s.hero.title).toBe('');
    expect(s.features.items).toEqual([]);
    const j = parseShowcase({ hero: { title: 5 }, features: { items: [{ icon: 'nope', title: 'Soft' }], on: 'x' }, cards: 'bad' });
    expect(j.hero.title).toBe('');
    expect(j.features.items[0]).toEqual({ icon: 'check', title: 'Soft', text: '' });
    expect(j.features.on).toBe(true);
    expect(j.cards.items).toEqual([]);
  });
  it('limits lists', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ icon: 'star', title: `T${i}`, text: '' }));
    const s = parseShowcase({ features: { items: many }, around: { left: many, right: many }, cards: { items: many } });
    expect(s.features.items).toHaveLength(8);
    expect(s.around.left).toHaveLength(4);
    expect(s.cards.items).toHaveLength(6);
  });
  it('turns description points into features with fitting icons', () => {
    expect(bulletItems(['Soft Fleece Lining: Keeps feet warm and cozy.', 'Water-Resistant Upper – Helps against splashes', 'Just a line'])).toEqual([
      { icon: 'snow', title: 'Soft Fleece Lining', text: 'Keeps feet warm and cozy.' },
      { icon: 'drop', title: 'Water-Resistant Upper', text: 'Helps against splashes' },
      { icon: 'check', title: 'Just a line', text: '' },
    ]);
    expect(guessIcon('Lightweight construction')).toBe('feather');
  });
  it('builds a page from the product: name, photos, points', () => {
    const s = showcaseFromProduct({ name: 'Slippers', photos: ['a', 'b', 'c'], bullets: Array.from({ length: 9 }, (_, i) => `Point ${i}: text`), intro: 'Warm.' });
    expect(s.hero.title).toBe('Slippers');
    expect(s.hero.image).toBe('a');
    expect(s.features.items).toHaveLength(5);
    expect(s.around.left.length + s.around.right.length).toBe(4);
    expect(s.around.image).toBe('a'); // photos repeat when there are few
    expect(s.cards.on).toBe(false);
  });
});
