import { z } from 'zod';

/**
 * Storefront settings (store_settings.storefront, JSON): which parts of the
 * header, footer and phone layout show, fonts, favicon, share image,
 * country and the invoice design. Anything missing or malformed falls back
 * to the defaults, so old rows keep working.
 */

export const FONT_CHOICES = {
  '': 'Theme default',
  cormorant: 'Cormorant Garamond (elegant serif)',
  playfair: 'Playfair Display (classic serif)',
  jost: 'Jost (clean)',
  poppins: 'Poppins (rounded)',
  inter: 'Inter (neutral)',
  jakarta: 'Plus Jakarta Sans (modern)',
} as const;
export type FontKey = keyof typeof FONT_CHOICES;
const fontKey = z.enum(Object.keys(FONT_CHOICES) as [FontKey, ...FontKey[]]).catch('');

export const INVOICE_TEMPLATES = {
  classic: { name: 'Classic', text: 'Black and white, clear table — prints well anywhere.' },
  modern: { name: 'Modern', text: 'Your brand colour band, logo and a big amount to collect.' },
  minimal: { name: 'Minimal', text: 'Light lines and lots of space.' },
  compact: { name: 'Compact (half page)', text: 'Two per A4 sheet — saves paper.' },
  thermal: { name: 'POS receipt (80 mm)', text: 'For a thermal receipt printer.' },
} as const;
export type InvoiceTemplate = keyof typeof INVOICE_TEMPLATES;
export const isInvoiceTemplate = (v: unknown): v is InvoiceTemplate => typeof v === 'string' && v in INVOICE_TEMPLATES;

const on = z.boolean().catch(true);
const off = z.boolean().catch(false);
const path = z.string().max(300).regex(/^brand\/[\w-]+\.(png|jpg|webp|avif|ico)$/).nullable().catch(null);

/** "property/widget" from a tawk.to chat link or its whole widget code; null when there is none. */
export function parseLiveChat(input: string): string | null {
  const m = /tawk\.to\/(?:chat\/)?([a-f0-9]{24})\/([a-z0-9]{1,40})/i.exec(input);
  return m ? `${m[1]}/${m[2]}` : null;
}

const popupLink = z.string().trim().max(200).regex(/^(\/|https?:\/\/)/).catch('/products');
const popupText = (max: number) => z.string().trim().max(max).catch('');
const DEFAULT_POPUPS = {
  welcome: { enabled: true, title: 'Free delivery over ৳2,999', text: 'Order above ৳2,999 and delivery is free, all over Bangladesh.', button: 'Shop now', link: '/products' },
  exit: { enabled: true, title: 'Wait! 10% off your first order', text: 'New customers get 10% off. Use this code at checkout.', code: 'WELCOME10', button: 'Shop now', link: '/products' },
};

export const storefrontSchema = z.object({
  header: z.object({ announcement: on, search: on, track: on, call: on, menu: on, sticky: on }).catch({ announcement: true, search: true, track: true, call: true, menu: true, sticky: true }),
  footer: z.object({ newsletter: on, social: on, contact: on }).catch({ newsletter: true, social: true, contact: true }),
  layout: z.object({ bottom_nav: on, back_to_top: on, whatsapp: off, breadcrumbs: on }).catch({ bottom_nav: true, back_to_top: true, whatsapp: false, breadcrumbs: true }),
  font_heading: fontKey,
  font_body: fontKey,
  favicon: path,
  og_image: path,
  site_title: z.string().trim().max(70).catch(''),
  country: z.string().trim().max(60).catch('Bangladesh'),
  popups: z.object({
    welcome: z.object({ enabled: on, title: popupText(80), text: popupText(200), button: popupText(30), link: popupLink }),
    exit: z.object({ enabled: on, title: popupText(80), text: popupText(200), code: z.string().trim().toUpperCase().regex(/^([A-Z0-9_-]{3,24})?$/).catch(''), button: popupText(30), link: popupLink }),
  }).catch(DEFAULT_POPUPS),
  live_chat: z.string().regex(/^[a-f0-9]{24}\/[a-z0-9]{1,40}$/i).nullable().catch(null),
  invoice: z
    .object({
      template: z.enum(Object.keys(INVOICE_TEMPLATES) as [InvoiceTemplate, ...InvoiceTemplate[]]).catch('classic'),
      show_logo: on,
      show_sku: on,
      title: z.string().trim().max(40).catch('Invoice'),
      footer: z.string().trim().max(300).catch(''),
    })
    .catch({ template: 'classic', show_logo: true, show_sku: true, title: 'Invoice', footer: '' }),
});
export type Storefront = z.infer<typeof storefrontSchema>;

export function parseStorefront(raw: unknown): Storefront {
  return storefrontSchema.parse(raw && typeof raw === 'object' ? raw : {});
}
