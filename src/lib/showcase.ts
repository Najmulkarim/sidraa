/**
 * "Showcase" landing page template: big dark hero, a features list beside a
 * photo, wide photo banners, features on both sides of a photo, a grid of
 * photo cards, the buy box, real reviews and a contact block. Every word and
 * photo is editable; empty parts are left out. Pure helpers — tested in
 * tests/unit/showcase.test.ts.
 */
import { z } from 'zod';
import type { IconName } from '@/components/icons';
import { splitBullet } from './product-content';

export const LANDING_TEMPLATES = ['classic', 'showcase', 'story'] as const;
export type LandingTemplate = (typeof LANDING_TEMPLATES)[number];

export const FEATURE_ICONS = ['check', 'star', 'heart', 'bolt', 'shield', 'drop', 'leaf', 'sun', 'snow', 'feather', 'gift', 'ruler', 'sparkle', 'hand', 'truck', 'clock', 'phone', 'cash', 'return'] as const satisfies readonly IconName[];
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

const str = (max: number) => z.string().trim().max(max).catch('');
const img = z.string().trim().max(300).nullable().catch(null);
const item = z.object({ icon: z.enum(FEATURE_ICONS).catch('check'), title: str(80), text: str(200) });
const card = z.object({ image: img, title: str(80), text: str(300) });
const items = <T extends z.ZodType>(t: T, max: number) => z.array(t).catch([]).transform((xs) => xs.slice(0, max));

export const showcaseSchema = z.object({
  hero: z.object({ eyebrow: str(60), title: str(120), text: str(300), button: str(40), image: img }).catch({ eyebrow: '', title: '', text: '', button: '', image: null }),
  features: z.object({ on: z.boolean().catch(true), eyebrow: str(60), title: str(120), image: img, items: items(item, 8) }).catch({ on: true, eyebrow: '', title: '', image: null, items: [] }),
  banner1: z.object({ on: z.boolean().catch(true), title: str(120), text: str(400), image: img }).catch({ on: true, title: '', text: '', image: null }),
  around: z.object({ on: z.boolean().catch(true), eyebrow: str(60), title: str(120), text: str(400), image: img, left: items(item, 4), right: items(item, 4) }).catch({ on: true, eyebrow: '', title: '', text: '', image: null, left: [], right: [] }),
  banner2: z.object({ on: z.boolean().catch(true), eyebrow: str(60), title: str(120), text: str(400), image: img }).catch({ on: true, eyebrow: '', title: '', text: '', image: null }),
  cards: z.object({ on: z.boolean().catch(true), eyebrow: str(60), title: str(120), text: str(400), items: items(card, 6) }).catch({ on: true, eyebrow: '', title: '', text: '', items: [] }),
  buy: z.object({ eyebrow: str(60), title: str(120), text: str(300) }).catch({ eyebrow: '', title: '', text: '' }),
  reviews: z.object({ eyebrow: str(60), title: str(120) }).catch({ eyebrow: '', title: '' }),
  contact: z.object({ on: z.boolean().catch(true), eyebrow: str(60), title: str(120), text: str(300) }).catch({ on: true, eyebrow: '', title: '', text: '' }),
});
export type Showcase = z.infer<typeof showcaseSchema>;
export type ShowcaseItem = z.infer<typeof item>;
export type ShowcaseCard = z.infer<typeof card>;

/** Whatever is stored (or nothing) → a complete, safe Showcase. */
export function parseShowcase(raw: unknown): Showcase {
  return showcaseSchema.parse(raw && typeof raw === 'object' ? raw : {});
}

/** Pick an icon that suits a feature's words. */
export function guessIcon(text: string): FeatureIcon {
  const t = text.toLowerCase();
  const rules: [RegExp, FeatureIcon][] = [
    [/warm|winter|cold|fleece|thermal/, 'snow'],
    [/water|rain|splash|wash/, 'drop'],
    [/light ?weight|light|airy|feather/, 'feather'],
    [/soft|comfort|cushion|cozy|cosy/, 'heart'],
    [/durab|strong|sole|last|protect|safe/, 'shield'],
    [/size|fit|length|cm|inch/, 'ruler'],
    [/colou?r|style|design|look|elegant|premium/, 'sparkle'],
    [/easy|slip|quick|fast|simple/, 'bolt'],
    [/natural|cotton|eco|breath/, 'leaf'],
    [/gift/, 'gift'],
    [/summer|sun|heat/, 'sun'],
    [/hand|grip|touch/, 'hand'],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? 'check';
}

/** A product's description points ("Soft lining: keeps feet warm") as feature items. */
export function bulletItems(bullets: string[]): ShowcaseItem[] {
  return bullets
    .map((b) => {
      const [title, text] = splitBullet(b);
      const t = (title ?? text).replace(/[.:]+$/, '').slice(0, 80);
      return { icon: guessIcon(b), title: t, text: title ? text.slice(0, 200) : '' };
    })
    .filter((i) => i.title);
}

/**
 * A new showcase filled from the product: its name, its photos and its
 * description points. Section titles are plain words the shop can change.
 */
export function showcaseFromProduct(p: { name: string; photos: string[]; bullets: string[]; intro: string }): Showcase {
  const photo = (i: number) => (p.photos.length ? p.photos[i % p.photos.length]! : null);
  const all = bulletItems(p.bullets);
  const features = all.slice(0, 5);
  const rest = all.slice(5, 13);
  const half = Math.ceil(rest.length / 2);
  return parseShowcase({
    hero: { eyebrow: '', title: p.name, text: p.intro.slice(0, 300), button: 'Order now', image: photo(0) },
    features: { on: true, eyebrow: 'Why it stands out', title: 'Main features', image: photo(1), items: features },
    banner1: { on: true, title: 'Made to last', text: '', image: photo(2) },
    around: { on: rest.length > 0, eyebrow: 'Made for every day', title: 'Everything you need', text: '', image: photo(3), left: rest.slice(0, half), right: rest.slice(half) },
    banner2: { on: p.photos.length > 4, eyebrow: '', title: 'Your everyday favourite', text: '', image: photo(4) },
    cards: { on: p.photos.length > 5, eyebrow: 'Take a closer look', title: 'Every detail', text: '', items: p.photos.slice(5, 11).map((image) => ({ image, title: '', text: '' })) },
    buy: { eyebrow: 'Order now', title: p.name, text: 'Cash on delivery — pay when it reaches you.' },
    reviews: { eyebrow: 'Reviews', title: 'Feedback from our customers' },
    contact: { on: true, eyebrow: 'Need help?', title: 'Get in touch', text: 'Call or WhatsApp us — we are happy to help you choose.' },
  });
}
