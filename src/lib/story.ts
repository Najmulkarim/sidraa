/**
 * "Story" landing page template: a product-page style top (photos, name, price,
 * order / WhatsApp / call buttons), then the product's story in blocks — a
 * heading, text and a marked list each — then big poster photos, the order
 * form and a call / WhatsApp band. Every word and photo editable; empty parts
 * are left out. Pure helpers — tested in tests/unit/story.test.ts.
 */
import { z } from 'zod';
import { splitBullet } from './product-content';

const str = (max: number) => z.string().trim().max(max).catch('');
const point = z.object({ mark: str(8), text: str(240) });
/** A list where a broken item is dropped, not the whole list. */
const list = <T extends z.ZodType>(t: T, max: number) =>
  z.array(z.unknown()).catch([]).transform((xs) => xs.flatMap((x) => { const r = t.safeParse(x); return r.success ? [r.data as z.infer<T>] : []; }).slice(0, max));
const block = z.object({
  title: str(100),
  text: str(2000),
  points: list(point, 15),
});

export const storySchema = z.object({
  top: z.object({ order: str(40), whatsapp: str(40), call: str(40) }).catch({ order: '', whatsapp: '', call: '' }),
  title: str(200),
  blocks: list(block, 10),
  images: list(z.string().trim().min(1).max(300), 12),
  order: z.object({ title: str(120), text: str(300) }).catch({ title: '', text: '' }),
  contact: z.object({ on: z.boolean().catch(true), title: str(120), text: str(300) }).catch({ on: true, title: '', text: '' }),
});
export type Story = z.infer<typeof storySchema>;
export type StoryBlock = z.infer<typeof block>;
export type StoryPoint = z.infer<typeof point>;

export function parseStory(raw: unknown): Story {
  return storySchema.parse(raw && typeof raw === 'object' ? raw : {});
}

/** Default words for the buttons and the call band (the shop can change them). */
export const STORY_DEFAULTS = {
  order: 'অর্ডার করুন',
  whatsapp: 'WhatsApp-এ অর্ডার',
  call: 'কল করে অর্ডার',
  orderTitle: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
  orderText: 'পণ্য হাতে পেয়ে টাকা দিন — ক্যাশ অন ডেলিভারি।',
  contactTitle: 'কোনো প্রশ্ন আছে?',
  contactText: 'পণ্য, অর্ডার বা ডেলিভারি নিয়ে সরাসরি কল বা WhatsApp করুন।',
} as const;

/** A public storage link to one of our product photos → its storage path (else null). */
export function storagePath(url: string): string | null {
  const m = /\/storage\/v1\/object\/public\/product-images\/(.+)$/.exec(url);
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * A new story filled from the product: its name as the big title, the first
 * paragraph, its description points as one list, and the description's own
 * pictures as posters (else the product photos after the first).
 */
export function storyFromProduct(p: { name: string; intro: string; bullets: string[]; posters: string[]; photos: string[] }): Story {
  const points = p.bullets.map((b) => {
    const [lead, rest] = splitBullet(b);
    return { mark: '✔', text: lead ? `${lead}: ${rest}` : rest };
  });
  const blocks = [
    ...(p.intro ? [{ title: 'পণ্যের পরিচিতি', text: p.intro, points: [] }] : []),
    ...(points.length ? [{ title: 'বৈশিষ্ট্য', text: '', points }] : []),
  ];
  return parseStory({
    top: { order: STORY_DEFAULTS.order, whatsapp: STORY_DEFAULTS.whatsapp, call: STORY_DEFAULTS.call },
    title: p.name,
    blocks,
    images: p.posters.length ? p.posters : p.photos.slice(1, 5),
    order: { title: STORY_DEFAULTS.orderTitle, text: STORY_DEFAULTS.orderText },
    contact: { on: true, title: STORY_DEFAULTS.contactTitle, text: STORY_DEFAULTS.contactText },
  });
}
