import { normalizeBdPhone } from './phone';

/**
 * Splits a product description, as typed in the admin, into the parts the
 * product page shows separately (Amazon style):
 *   - lines starting with -, •, *, ✓ or ✔  → "About this item" bullets
 *   - "Label: value" lines                  → "Product details" table
 *   - everything else                       → the free-text description
 * Nothing needs a special field: a plain paragraph stays a paragraph.
 */
export type ProductContent = { bullets: string[]; specs: [string, string][]; text: string };

// -, •, *, ✓, ✔, ✅, ☑, ▪, ●, ◆, ➤, ►, 🔹, 🔸 — with or without the emoji variation selector.
// A dash, dot or star needs a space after it ("-5% off" stays text); symbols and emoji do not.
const BULLET = /^(?:[-•*]\s+|(?:[✓✔✅☑▪●◆➤►]|🔹|🔸)️?\s*)(.+)$/u;
// Short label, a colon, then a value; not a URL ("https://…") or a time ("10:30").
const SPEC = /^([^:\n]{1,40}?)\s*:\s+(.{1,200})$/;

export function parseDescription(description: string | null | undefined): ProductContent {
  const bullets: string[] = [];
  const specs: [string, string][] = [];
  const text: string[] = [];
  for (const raw of (description ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = BULLET.exec(line);
    const spec = bullet ? null : SPEC.exec(line);
    // "✅ Main Features:" is a heading for the list, not an item.
    if (bullet) {
      if (!/:\s*$/.test(bullet[1]!)) bullets.push(bullet[1]!.trim());
    }
    else if (spec && !/^https?$/i.test(spec[1]!) && !/^\d+$/.test(spec[1]!)) specs.push([spec[1]!.trim(), spec[2]!.trim()]);
    else text.push(raw);
  }
  return { bullets, specs, text: text.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/** "Premium Metal Frame – Sleek and durable" → ["Premium Metal Frame", "Sleek and durable"]; no dash → [null, text]. */
export function splitBullet(text: string): [string | null, string] {
  const m = /^(.{2,60}?)\s+[–—-]\s+(.+)$/.exec(text);
  return m ? [m[1]!, m[2]!] : [null, text];
}

/** wa.me link to the shop's number with a ready-made order message, or null without a valid BD mobile. */
export function whatsappOrderLink(shopPhone: string | null | undefined, message: string): string | null {
  const phone = normalizeBdPhone(shopPhone);
  return phone ? `https://wa.me/88${phone}?text=${encodeURIComponent(message)}` : null;
}
