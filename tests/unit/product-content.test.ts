import { describe, expect, it } from 'vitest';
import { boldPerLine, boldRuns, parseDescription, splitBullet, whatsappOrderLink } from '@/lib/product-content';

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
    expect(parseDescription(null)).toEqual({ bullets: [], groups: [], specs: [], text: '', blocks: [], flow: [] });
  });
});

describe('formatted descriptions', () => {
  it('keeps lists, text and pictures in the order typed', () => {
    const r = parseDescription('## Features\n- Soft\n\n![](https://x.co/a.jpg)\n\nMaterial: PU\n\nWarm.');
    expect(r.flow.map((f) => f.type)).toEqual(['list', 'img', 'p']);
  });
  it('reads pictures as their own blocks', () => {
    const r = parseDescription('Look:\n![Pink pair](https://x.supabase.co/a.jpg)\n![](https://x.supabase.co/b.jpg)');
    expect(r.blocks).toEqual([{ type: 'p', text: 'Look:' }, { type: 'img', text: 'Pink pair', src: 'https://x.supabase.co/a.jpg' }, { type: 'img', text: '', src: 'https://x.supabase.co/b.jpg' }]);
    expect(r.specs).toEqual([]);
  });
  it('reads list styles, list titles and headings', () => {
    const r = parseDescription('# Winter slippers\nWarm and light.\n\n## Key features\n- **Soft** lining\n• Non-slip sole\n➤ Easy slip-on\n1. Wash by hand\n2. Dry flat');
    expect(r.groups).toEqual([{ title: 'Key features', items: [
      { kind: 'check', text: '**Soft** lining' }, { kind: 'dot', text: 'Non-slip sole' }, { kind: 'arrow', text: 'Easy slip-on' },
      { kind: 'number', text: 'Wash by hand' }, { kind: 'number', text: 'Dry flat' },
    ] }]);
    expect(r.blocks).toEqual([{ type: 'h1', text: 'Winter slippers' }, { type: 'p', text: 'Warm and light.' }]);
  });
  it('keeps a small heading as text when no list follows it', () => {
    expect(parseDescription('## Care\nWipe clean.').blocks).toEqual([{ type: 'h2', text: 'Care' }, { type: 'p', text: 'Wipe clean.' }]);
  });
  it('makes bold over several lines bold on each line', () => {
    expect(boldPerLine('**Email: a@b.com\nPhone: 017\nAddress: Dhaka**')).toBe('**Email: a@b.com**\n**Phone: 017**\n**Address: Dhaka**');
    expect(boldPerLine('A **b** c')).toBe('A **b** c');
  });
  it('turns **bold** into bold runs', () => {
    expect(boldRuns('A **soft** lining')).toEqual([['A ', false], ['soft', true], [' lining', false]]);
    expect(boldRuns('no marks')).toEqual([['no marks', false]]);
  });
  it('bolds the part before a colon in a list item', () => {
    expect(splitBullet('Soft Fleece Lining: Keeps feet warm')).toEqual(['Soft Fleece Lining', 'Keeps feet warm']);
    expect(splitBullet('See https://x.com')).toEqual([null, 'See https://x.com']);
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
