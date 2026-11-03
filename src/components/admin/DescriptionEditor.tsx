'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { descriptionToHtml, type ListMark } from '@/lib/description-html';
import { parseDescription } from '@/lib/product-content';
import { ListGroups, TextBlocks } from '../shop/DescriptionParts';

const LIST_PREFIX: Record<ListMark, string> = { check: '- ', dot: '• ', arrow: '➤ ' };

/** Inline text of an element, with bold parts as **bold**. */
function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/ /g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  const inner = Array.from(node.childNodes).map(inlineText).join('');
  const weight = Number(node.style.fontWeight) || (node.style.fontWeight === 'bold' ? 700 : 0);
  if ((node.tagName === 'B' || node.tagName === 'STRONG' || weight >= 600) && inner.trim()) {
    const [, lead, body, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
    return `${lead}**${body!.replace(/\*\*/g, '')}**${tail}`;
  }
  return inner;
}

const BLOCK = /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|SECTION)$/;

/** The editor's HTML back to the stored text (see descriptionToHtml). */
function toText(root: HTMLElement): string {
  const blocks: { text: string; list: boolean }[] = [];
  let loose = '';
  const flushLoose = () => {
    if (loose.trim()) blocks.push({ text: loose.trim(), list: false });
    loose = '';
  };
  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (!(node instanceof HTMLElement) || !BLOCK.test(node.tagName)) { loose += inlineText(node); continue; }
      flushLoose();
      const tag = node.tagName;
      if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
        const t = inlineText(node).replace(/\s+/g, ' ').replace(/\*\*/g, '').trim();
        if (t) blocks.push({ text: `${tag === 'H1' ? '#' : '##'} ${t}`, list: false });
      } else if (tag === 'UL' || tag === 'OL') {
        const kind = (node.dataset.kind as ListMark) in LIST_PREFIX ? (node.dataset.kind as ListMark) : 'check';
        let n = 0;
        const lines = Array.from(node.querySelectorAll('li')).map((li) => inlineText(li).replace(/\s+/g, ' ').trim()).filter(Boolean)
          .map((t) => (tag === 'OL' ? `${++n}. ` : LIST_PREFIX[kind]) + t);
        if (lines.length) blocks.push({ text: lines.join('\n'), list: true });
      } else if (Array.from(node.children).some((c) => BLOCK.test(c.tagName))) {
        walk(node);
      } else {
        const t = inlineText(node).split('\n').map((l) => l.trim()).join('\n').trim();
        if (t) blocks.push({ text: t, list: false });
      }
    }
    flushLoose();
  };
  walk(root);
  // Lists right after each other stay one list on the product page.
  return blocks.map((b, i) => (i === 0 ? '' : b.list && blocks[i - 1]!.list ? '\n' : '\n\n') + b.text).join('');
}

/** The cursor as a count of characters from the start of the editor's text. */
function caretAt(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel?.anchorNode || !root.contains(sel.anchorNode)) return null;
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}

function putCaret(root: HTMLElement, at: number) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = at;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (left <= len) { window.getSelection()?.collapse(n, left); return; }
    left -= len;
  }
}

/** Product description, edited the way it looks (bold, headings, lists), saved as plain text. */
export function DescriptionEditor({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => descriptionToHtml(defaultValue));
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  const sync = () => { if (ref.current) setValue(toText(ref.current)); };
  function run(command: string, arg?: string) {
    const root = ref.current;
    if (!root) return;
    root.focus();
    // The browser sometimes moves the cursor to the start of the line; put it back.
    const sel = window.getSelection();
    const at = sel?.isCollapsed ? caretAt(root) : null;
    document.execCommand(command, false, arg);
    // A list or heading the browser left inside a paragraph: take it out.
    for (const p of Array.from(root.querySelectorAll('p'))) {
      if (p.querySelector('ul,ol,h1,h2,p')) p.replaceWith(...Array.from(p.childNodes));
    }
    if (at !== null) putCaret(root, at);
  }

  /** The block or list around the cursor, inside the editor. */
  function around(selector: string): HTMLElement | null {
    const node = window.getSelection()?.anchorNode;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    const hit = el?.closest(selector) as HTMLElement | null;
    return hit && ref.current?.contains(hit) && hit !== ref.current ? hit : null;
  }

  function heading(tag: 'H1' | 'H2') {
    const block = around('h1,h2,h3,p,div,li');
    if (block?.tagName === 'LI') run(block.parentElement?.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    run('formatBlock', around('h1,h2')?.tagName === tag ? 'P' : tag);
    sync();
  }

  function list(kind: ListMark | 'number') {
    const current = around('ul,ol');
    if (around('h1,h2')) run('formatBlock', 'P');
    if (kind === 'number') run('insertOrderedList');
    else if (current?.tagName === 'UL' && current.dataset.kind !== kind) current.dataset.kind = kind;
    else {
      run('insertUnorderedList');
      const made = around('ul');
      if (made) made.dataset.kind = kind;
    }
    sync();
  }

  function plain() {
    const current = around('ul,ol');
    if (current) run(current.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    run('formatBlock', 'P');
    sync();
  }

  // Keep the text selection when a toolbar button is pressed.
  const keep = (e: MouseEvent) => e.preventDefault();
  const btn = 'grid h-8 min-w-8 place-items-center rounded-md border border-line bg-white px-2 text-[13px] font-semibold hover:border-brand hover:text-brand';
  const content = parseDescription(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Description formatting">
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={keep} onClick={() => { run('bold'); sync(); }} className={btn}>B</button>
        <button type="button" title="Large heading" aria-label="Large heading" onMouseDown={keep} onClick={() => heading('H1')} className={`${btn} text-[15px]`}>H1</button>
        <button type="button" title="Small heading (over a list it becomes the list title)" aria-label="Small heading" onMouseDown={keep} onClick={() => heading('H2')} className={btn}>H2</button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <button type="button" title="Check list" aria-label="Check list" onMouseDown={keep} onClick={() => list('check')} className={`${btn} text-ok`}>✓</button>
        <button type="button" title="Dot list" aria-label="Dot list" onMouseDown={keep} onClick={() => list('dot')} className={btn}>•</button>
        <button type="button" title="Arrow list" aria-label="Arrow list" onMouseDown={keep} onClick={() => list('arrow')} className={btn}>➤</button>
        <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={keep} onClick={() => list('number')} className={btn}>1.</button>
        <button type="button" title="Normal text" aria-label="Normal text" onMouseDown={keep} onClick={plain} className={`${btn} font-normal`}>Text</button>
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={`ml-auto rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${preview ? 'bg-night text-white' : 'border border-line bg-white hover:border-brand'}`}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
      </div>
      <div className="relative">
        <div
          ref={ref}
          id="description"
          role="textbox"
          aria-multiline="true"
          aria-label="Description"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initial }}
          onInput={sync}
          onBlur={sync}
          onPaste={(e) => {
            // Paste as text, formatted the same way (lists and headings in the pasted text are kept).
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            if (text.includes('\n')) run('insertHTML', descriptionToHtml(text));
            else run('insertText', text);
            sync();
          }}
          className="rte input min-h-48 overflow-auto"
        />
        {!value.trim() && <p className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-muted">{placeholder}</p>}
      </div>
      <input type="hidden" name="description" value={value} />
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
