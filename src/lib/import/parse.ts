/**
 * Reads a product out of a web page. Pure, so it is unit tested. Sites describe
 * products in a few standard ways; the first one found wins and the page's
 * social tags fill what is missing. Anything not found is left empty for staff.
 */
export type ImportedVariant = { color: string; size: string; option3: string; price: number | null; image: string | null };
export type ImportedProduct = {
  name: string;
  description: string;
  /** In Taka only: another currency is not converted, so it stays null. */
  price: number | null;
  images: string[];
  colorLabel: string | null;
  sizeLabel: string | null;
  option3Label: string | null;
  variants: ImportedVariant[];
};

const MAX_IMAGES = 12;
const MAX_VARIANTS = 50;

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export function plainText(html: string): string {
  return decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<(br|\/p|\/li|\/div)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function absolute(u: unknown, base: string): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  try {
    const url = new URL(decode(u.trim()), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function money(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const unique = <T,>(a: T[]) => [...new Set(a)];

/** Every object in a parsed JSON value. */
function* walk(v: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (!v || typeof v !== 'object' || depth > 12) return;
  if (Array.isArray(v)) {
    for (const x of v) yield* walk(x, depth + 1);
    return;
  }
  yield v as Record<string, unknown>;
  for (const x of Object.values(v)) yield* walk(x, depth + 1);
}

function scripts(html: string, test: RegExp): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!test.test(m[1] ?? '')) continue;
    try {
      out.push(JSON.parse(m[2] ?? ''));
    } catch { /* not valid JSON: skip this block */ }
  }
  return out;
}

function meta(html: string, ...names: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (key && names.includes(key)) {
      const c = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      const value = c?.[1] ?? c?.[2];
      if (value?.trim()) return decode(value.trim());
    }
  }
  return null;
}

const empty = (name: string): ImportedProduct => ({ name, description: '', price: null, images: [], colorLabel: null, sizeLabel: null, option3Label: null, variants: [] });

/** Marketplace pages built on variation groups (China Source and similar). */
function fromVariationData(html: string, base: string): ImportedProduct | null {
  for (const block of scripts(html, /__NEXT_DATA__/i)) {
    for (const o of walk(block)) {
      const groups = o.variation_groups;
      if (typeof o.title !== 'string' || !Array.isArray(groups)) continue;
      const keys = (groups as { key?: unknown }[]).map((g) => String(g.key ?? '')).filter(Boolean).slice(0, 3);
      const items = Array.isArray(o.variation_items) ? (o.variation_items as { variant?: Record<string, unknown>; regular_price?: unknown; sale_price?: unknown; image?: unknown }[]) : [];
      const groupImage = new Map<string, unknown>();
      for (const g of groups as { options?: { name?: unknown; image?: unknown }[] }[]) for (const op of g.options ?? []) if (op.image) groupImage.set(String(op.name), op.image);
      const at = (i: { variant?: Record<string, unknown> }, n: number) => (keys[n] ? String(i.variant?.[keys[n]!] ?? '') : '');
      const p = empty(o.title);
      p.description = typeof o.description === 'string' ? plainText(o.description) : '';
      const specs = o.specifications && typeof o.specifications === 'object' ? Object.entries(o.specifications as Record<string, unknown>).map(([k, v]) => `- ${k}: ${String(v)}`).join('\n') : '';
      if (!p.description && specs) p.description = specs;
      p.price = money(o.sale_price) ?? money(o.regular_price);
      [p.colorLabel, p.sizeLabel, p.option3Label] = [keys[0] ?? null, keys[1] ?? null, keys[2] ?? null];
      p.images = (Array.isArray(o.images) ? o.images : []).map((u) => absolute(u, base)).filter((u): u is string => !!u);
      p.variants = items.map((i) => ({
        color: at(i, 0), size: at(i, 1), option3: at(i, 2),
        price: money(i.sale_price) ?? money(i.regular_price),
        image: absolute(groupImage.get(at(i, 0)) ?? i.image, base),
      }));
      return p;
    }
  }
  return null;
}

/** The schema.org Product block most shops publish for Google. */
function fromJsonLd(html: string, base: string, onlyTaka: (currency: unknown) => boolean): ImportedProduct | null {
  for (const block of scripts(html, /application\/ld\+json/i)) {
    for (const o of walk(block)) {
      const type = o['@type'];
      if (!(type === 'Product' || (Array.isArray(type) && type.includes('Product'))) || typeof o.name !== 'string') continue;
      const p = empty(decode(o.name));
      p.description = typeof o.description === 'string' ? plainText(o.description) : '';
      const imgs = Array.isArray(o.image) ? o.image : [o.image];
      p.images = imgs.map((i) => absolute(typeof i === 'object' && i ? (i as { url?: unknown }).url : i, base)).filter((u): u is string => !!u);
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      const offer = (offers ?? {}) as { price?: unknown; lowPrice?: unknown; priceCurrency?: unknown };
      if (onlyTaka(offer.priceCurrency)) p.price = money(offer.price) ?? money(offer.lowPrice);
      return p;
    }
  }
  return null;
}

/** A Shopify product (the answer of /products/<name>.json). */
export function fromShopify(body: unknown, base: string, onlyTaka: (currency: unknown) => boolean, currency: unknown): ImportedProduct | null {
  const prod = (body as { product?: Record<string, unknown> } | null)?.product;
  if (!prod || typeof prod.title !== 'string') return null;
  const p = empty(prod.title);
  p.description = typeof prod.body_html === 'string' ? plainText(prod.body_html) : '';
  const images = (Array.isArray(prod.images) ? prod.images : []) as { id?: unknown; src?: unknown }[];
  p.images = images.map((i) => absolute(i.src, base)).filter((u): u is string => !!u);
  const opts = (Array.isArray(prod.options) ? prod.options : []) as { name?: unknown }[];
  const named = opts.map((o) => String(o.name ?? '')).filter((n) => n && n !== 'Title');
  [p.colorLabel, p.sizeLabel, p.option3Label] = [named[0] ?? null, named[1] ?? null, named[2] ?? null];
  const taka = onlyTaka(currency);
  const vs = (Array.isArray(prod.variants) ? prod.variants : []) as Record<string, unknown>[];
  p.price = taka ? money(vs[0]?.price) : null;
  if (named.length) {
    p.variants = vs.map((v) => ({
      color: String(v.option1 ?? ''), size: String(v.option2 ?? ''), option3: String(v.option3 ?? ''),
      price: taka ? money(v.price) : null,
      image: absolute(images.find((i) => i.id === v.image_id)?.src, base),
    }));
  }
  return p;
}

/** Pulls everything it can from the page. null when the page does not describe a product. */
export function parseProductPage(html: string, url: string, shopify?: unknown): ImportedProduct | null {
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const currency = meta(html, 'product:price:currency', 'og:price:currency');
  // Without a stated currency, only a Bangladeshi site is taken to mean Taka.
  const onlyTaka = (c: unknown) => (typeof c === 'string' && c ? /^(BDT|TK|৳)$/i.test(c) : host.endsWith('.bd'));

  const p = fromVariationData(html, url) ?? fromShopify(shopify, url, onlyTaka, currency) ?? fromJsonLd(html, url, onlyTaka) ?? empty(meta(html, 'og:title', 'twitter:title') ?? '');
  if (!p.name.trim()) return null;

  p.name = p.name.replace(/\s+/g, ' ').trim().slice(0, 160);
  p.description = (p.description || plainText(meta(html, 'og:description', 'description') ?? '')).slice(0, 10_000);
  if (p.price === null && onlyTaka(currency)) p.price = money(meta(html, 'product:price:amount', 'og:price:amount'));
  const og = absolute(meta(html, 'og:image', 'og:image:secure_url', 'twitter:image'), url);
  p.images = unique([...p.images, ...p.variants.map((v) => v.image).filter((u): u is string => !!u), ...(og ? [og] : [])]).slice(0, MAX_IMAGES);

  // Fit the shop's limits; the same combination twice would be refused.
  const seen = new Set<string>();
  p.variants = p.variants
    .map((v) => ({ ...v, color: v.color.trim().slice(0, 30), size: v.size.trim().slice(0, 20), option3: v.option3.trim().slice(0, 30) }))
    .filter((v) => {
      const k = `${v.color}|${v.size}|${v.option3}`.toLowerCase();
      if (seen.has(k) || k === '||') return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_VARIANTS);
  p.colorLabel = p.colorLabel?.slice(0, 20) || null;
  p.sizeLabel = p.sizeLabel?.slice(0, 20) || null;
  p.option3Label = p.option3Label?.slice(0, 20) || null;
  return p;
}
