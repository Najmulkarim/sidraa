'use client';

import { useRef, useState } from 'react';
import { parseDescription } from '@/lib/product-content';
import { ListGroups, TextBlocks } from '../shop/DescriptionParts';

type LineStyle = { label: string; title: string; prefix: (n: number) => string };

const LINE_STYLES: LineStyle[] = [
  { label: 'H1', title: 'Large heading', prefix: () => '# ' },
  { label: 'H2', title: 'Small heading (over a list it becomes the list title)', prefix: () => '## ' },
  { label: '✓', title: 'Check list', prefix: () => '- ' },
  { label: '•', title: 'Dot list', prefix: () => '• ' },
  { label: '➤', title: 'Arrow list', prefix: () => '➤ ' },
  { label: '1.', title: 'Numbered list', prefix: (n) => `${n}. ` },
  { label: 'Aa', title: 'Plain text (remove heading or list mark)', prefix: () => '' },
];
// Any mark this editor (or an older description) may have put at the start of a line.
const MARK = /^\s*(?:#{1,2}\s+|[-•*]\s+|\d{1,2}[.)]\s+|(?:[✓✔✅☑▪●◆➤►]|🔹|🔸)️?\s*)/u;

/** Product description with a small toolbar and a live preview of how the product page shows it. */
export function DescriptionEditor({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  // Edit through the browser's own text tools so Ctrl+Z still works.
  function replace(start: number, end: number, text: string, select?: [number, number]) {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) ta.setRangeText(text, start, end, 'end');
    if (select) ta.setSelectionRange(select[0], select[1]);
    setValue(ta.value);
  }

  function styleLines(style: LineStyle) {
    const ta = ref.current;
    if (!ta) return;
    const v = ta.value;
    const start = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const endBreak = v.indexOf('\n', ta.selectionEnd);
    const end = endBreak === -1 ? v.length : endBreak;
    let n = 0;
    const lines = v.slice(start, end).split('\n').map((line) => {
      const body = line.replace(MARK, '');
      if (!body.trim()) return line;
      n++;
      return style.prefix(n) + body;
    });
    replace(start, end, lines.join('\n'));
  }

  function bold() {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b } = ta;
    const picked = ta.value.slice(a, b);
    if (picked.startsWith('**') && picked.endsWith('**') && picked.length > 4) return replace(a, b, picked.slice(2, -2));
    const text = picked || 'bold text';
    replace(a, b, `**${text}**`, [a + 2, a + 2 + text.length]);
  }

  const content = parseDescription(value);
  const btn = 'grid h-8 min-w-8 place-items-center rounded-md border border-line bg-white px-2 text-[13px] font-semibold hover:border-brand hover:text-brand';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Description formatting">
        <button type="button" title="Bold (select text first)" onClick={bold} className={btn}>B</button>
        {LINE_STYLES.map((st) => (
          <button key={st.label} type="button" title={st.title} aria-label={st.title} onClick={() => styleLines(st)} className={btn}>{st.label}</button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={`ml-auto rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${preview ? 'bg-night text-white' : 'border border-line bg-white hover:border-brand'}`}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
      </div>
      <textarea ref={ref} id="description" name="description" rows={10} maxLength={10000} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="input" />
      {preview && (
        <div className="space-y-5 rounded-xl border border-dashed border-line bg-soft/60 p-4" aria-label="Preview">
          {content.groups.length > 0 && <section><p className="mb-2 text-lg font-bold">About this item</p><ListGroups groups={content.groups} /></section>}
          {content.specs.length > 0 && (
            <section>
              <p className="mb-2 text-lg font-bold">Product details</p>
              <ul className="space-y-1 text-[14px]">{content.specs.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul>
            </section>
          )}
          {content.blocks.length > 0 && <section><p className="mb-2 text-lg font-bold">Description</p><TextBlocks blocks={content.blocks} /></section>}
          {!value.trim() && <p className="text-sm text-muted">Nothing to show yet.</p>}
        </div>
      )}
    </div>
  );
}
