/**
 * The admin description editor shows the description formatted (Word style),
 * while it is stored as plain text with light marks: "# " large heading,
 * "## " small heading, "- " / "• " / "➤ " / "1. " list lines, **bold**.
 * This turns the stored text into the editor's HTML; the editor turns its
 * HTML back into text when it changes.
 */
export type ListMark = 'check' | 'dot' | 'arrow';

import { boldPerLine, IMAGE } from './product-content';

const HEADING = /^(#{1,2})\s+(.+)$/;
const BULLET = /^(?:([-•*])\s+|(\d{1,2})[.)]\s+|([✓✔✅☑▪●◆➤►]|🔹|🔸)️?\s*)(.+)$/u;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function markOf(m: RegExpExecArray): ListMark | 'number' {
  if (m[2]) return 'number';
  const mark = m[1] ?? m[3] ?? '';
  if (mark === '•' || mark === '*' || mark === '▪' || mark === '●') return 'dot';
  if (mark === '➤' || mark === '►' || mark === '◆' || mark === '🔹' || mark === '🔸') return 'arrow';
  return 'check';
}

export function descriptionToHtml(text: string | null | undefined): string {
  const out: string[] = [];
  let para: string[] = [];
  let list = null as { kind: ListMark | 'number'; items: string[] } | null;
  const flush = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
    para = [];
    if (list) {
      out.push(list.kind === 'number'
        ? `<ol>${list.items.map((i) => `<li>${i}</li>`).join('')}</ol>`
        : `<ul data-kind="${list.kind}">${list.items.map((i) => `<li>${i}</li>`).join('')}</ul>`);
    }
    list = null;
  };
  for (const raw of boldPerLine((text ?? '').replace(/\r\n/g, '\n')).split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const img = IMAGE.exec(line);
    if (img) { flush(); out.push(`<p><img src="${escape(img[2]!)}" alt="${escape(img[1]!)}"></p>`); continue; }
    const h = HEADING.exec(line);
    if (h) { flush(); out.push(h[1] === '#' ? `<h1>${inline(h[2]!)}</h1>` : `<h2>${inline(h[2]!)}</h2>`); continue; }
    const b = BULLET.exec(line);
    if (b) {
      const kind = markOf(b);
      if (para.length || (list && list.kind !== kind)) flush();
      list ??= { kind, items: [] };
      list.items.push(inline(b[4]!.trim()));
      continue;
    }
    if (list) flush();
    para.push(inline(line));
  }
  flush();
  return out.join('');
}
