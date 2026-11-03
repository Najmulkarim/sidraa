import { normalizeBdPhone } from './phone';

/**
 * Splits a product description, as typed in the admin, into the parts the
 * product page shows separately (Amazon style):
 *   - list lines ("- ", "• ", "➤ ", "1. ", ✓ …)  → "About this item", in groups
 *   - "Label: value" lines                        → "Product details" table
 *   - everything else                             → the description, where
 *     "# " is a large heading and "## " a small one
 * **Bold** works anywhere. A heading, or a line ending in ":", right before a
 * list becomes that list's title. Nothing needs a special field.
 */
export type ListKind = 'check' | 'dot' | 'arrow' | 'number';
export type ListGroup = { title: string | null; items: { kind: ListKind; text: string }[] };
export type TextBlock = { type: 'h1' | 'h2' | 'p'; text: string } | { type: 'img'; text: string; src: string };
export type ProductContent = { bullets: string[]; groups: ListGroup[]; specs: [string, string][]; text: string; blocks: TextBlock[] };

// -, •, *, ✓, ✔, ✅, ☑, ▪, ●, ◆, ➤, ►, 🔹, 🔸 — with or without the emoji variation selector, or "1." / "1)".
// A dash, dot, star or number needs a space after it ("-5% off" stays text); symbols and emoji do not.
const BULLET = /^(?:([-•*])\s+|(\d{1,2})[.)]\s+|([✓✔✅☑▪●◆➤►]|🔹|🔸)️?\s*)(.+)$/u;
// Short label, a colon, then a value; not a URL ("https://…") or a time ("10:30").
const SPEC = /^([^:\n]{1,40}?)\s*:\s+(.{1,200})$/;
const HEADING = /^(#{1,2})\s+(.+)$/;
// A picture: ![what it shows](https://…)
export const IMAGE = /^!\[([^\]]{0,200})\]\((https?:\/\/[^\s)]+)\)$/;

function kindOf(m: RegExpExecArray): ListKind {
  if (m[2]) return 'number';
  const mark = m[1] ?? m[3] ?? '';
  if (mark === '•' || mark === '*' || mark === '▪' || mark === '●') return 'dot';
  if (mark === '➤' || mark === '►' || mark === '◆' || mark === '🔹' || mark === '🔸') return 'arrow';
  return 'check';
}

export function parseDescription(description: string | null | undefined): ProductContent {
  const groups: ListGroup[] = [];
  const specs: [string, string][] = [];
  const blocks: TextBlock[] = [];
  const text: string[] = [];
  let pendingTitle: string | null = null; // a heading that may belong to the list right below it
  let open: ListGroup | null = null;
  const flushTitle = () => {
    if (pendingTitle !== null) {
      blocks.push({ type: 'h2', text: pendingTitle });
      text.push(pendingTitle);
      pendingTitle = null;
    }
  };
  const paragraph = (line: string) => {
    const last = blocks[blocks.length - 1];
    if (last?.type === 'p' && !last.text.endsWith('\n\n')) last.text += `\n${line}`;
    else blocks.push({ type: 'p', text: line });
  };
  for (const raw of (description ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (pendingTitle === null) {
        open = null;
        const last = blocks[blocks.length - 1];
        if (last?.type === 'p') last.text += '\n\n';
        text.push('');
      }
      continue;
    }
    const img = IMAGE.exec(line);
    if (img) {
      flushTitle();
      open = null;
      blocks.push({ type: 'img', text: img[1]!.trim(), src: img[2]! });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      const body = bullet[4]!.trim();
      // "✅ Main Features:" titles the list that follows.
      if (/:\s*$/.test(body)) { flushTitle(); pendingTitle = body.replace(/:\s*$/, ''); open = null; continue; }
      if (!open) { open = { title: pendingTitle, items: [] }; groups.push(open); pendingTitle = null; }
      open.items.push({ kind: kindOf(bullet), text: body });
      continue;
    }
    open = null;
    const heading = HEADING.exec(line);
    if (heading) {
      flushTitle();
      if (heading[1] === '#') { blocks.push({ type: 'h1', text: heading[2]!.trim() }); text.push(heading[2]!.trim()); }
      else pendingTitle = heading[2]!.trim();
      continue;
    }
    flushTitle();
    const spec = SPEC.exec(line);
    if (spec && !/^https?$/i.test(spec[1]!) && !/^\d+$/.test(spec[1]!)) specs.push([spec[1]!.trim(), spec[2]!.trim()]);
    else { paragraph(raw.trimEnd()); text.push(raw); }
  }
  flushTitle();
  for (const bl of blocks) bl.text = bl.text.trim();
  return {
    bullets: groups.flatMap((g) => g.items.map((i) => i.text)),
    groups,
    specs,
    text: text.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    blocks: blocks.filter((bl) => bl.type === 'img' || bl.text),
  };
}

/** "**Soft** lining" → [["Soft", true], [" lining", false]]: text runs, bold or not. */
export function boldRuns(text: string): [string, boolean][] {
  const out: [string, boolean][] = [];
  let at = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index! > at) out.push([text.slice(at, m.index), false]);
    out.push([m[1]!, true]);
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push([text.slice(at), false]);
  return out;
}

/** "Premium Metal Frame – Sleek and durable" or "Soft Lining: Keeps feet warm" → [lead, rest]; neither → [null, text]. */
export function splitBullet(text: string): [string | null, string] {
  const m = /^(.{2,60}?)\s+[–—-]\s+(.+)$/.exec(text) ?? /^([^:*]{2,40}?):\s+(.+)$/.exec(text);
  return m && !/^https?$/i.test(m[1]!) ? [m[1]!, m[2]!] : [null, text];
}

/** wa.me link to the shop's number with a ready-made order message, or null without a valid BD mobile. */
export function whatsappOrderLink(shopPhone: string | null | undefined, message: string): string | null {
  const phone = normalizeBdPhone(shopPhone);
  return phone ? `https://wa.me/88${phone}?text=${encodeURIComponent(message)}` : null;
}
