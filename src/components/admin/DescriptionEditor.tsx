'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { copyDescriptionImage } from '@/actions/admin-description-image';
import { imageUrl } from '@/lib/env';
import { PHOTO_ACCEPT, uploadProductPhoto } from '@/lib/upload-photo';
import { descriptionToHtml, type ListMark } from '@/lib/description-html';
import { boldPerLine, parseDescription } from '@/lib/product-content';
import { DescriptionFlow } from '../shop/DescriptionParts';

const LIST_PREFIX: Record<ListMark, string> = { check: '- ', dot: '• ', arrow: '➤ ' };

/** Inline text of an element, with bold parts as **bold**. */
function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/ /g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  if (node instanceof HTMLImageElement) {
    const src = node.getAttribute('src') ?? '';
    return /^https?:\/\//.test(src) ? `\n![${(node.alt || '').replace(/[[\]\n]/g, '')}](${src})\n` : '';
  }
  const inner = Array.from(node.childNodes).map(inlineText).join('');
  const weight = Number(node.style.fontWeight) || (node.style.fontWeight === 'bold' ? 700 : 0);
  if ((node.tagName === 'B' || node.tagName === 'STRONG' || weight >= 600) && inner.trim()) {
    const [, lead, body, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
    // Bold over several lines: each line gets its own marks.
    return `${lead}${boldPerLine(`**${body!.replace(/\*\*/g, '')}**`)}${tail}`;
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
        // A picture inside a list point goes below the list.
        const pictures: string[] = [];
        const lines = Array.from(node.querySelectorAll('li'))
          .map((li) => inlineText(li).replace(/!\[[^\]]*\]\([^)\s]+\)/g, (m) => { pictures.push(m); return ' '; }).replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .map((t) => (tag === 'OL' ? `${++n}. ` : LIST_PREFIX[kind]) + t);
        if (lines.length) blocks.push({ text: lines.join('\n'), list: true });
        for (const pic of pictures) blocks.push({ text: pic, list: false });
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
export function DescriptionEditor({ defaultValue, placeholder, productId, plain: plainPreview = false }: { defaultValue: string; placeholder: string; productId?: string; plain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => descriptionToHtml(defaultValue));
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const [imagePanel, setImagePanel] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  // Where the cursor was when the picture panel opened: pictures go there.
  const spot = useRef<number | null>(null);

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

  /** Puts pictures where the cursor was (or at the end). */
  function insertImages(urls: string[]) {
    const root = ref.current;
    if (!root || !urls.length) return;
    root.focus();
    // Each picture on its own line, below the line, point or list the cursor is in (never beside text).
    let block: Node | null = null;
    if (spot.current !== null) {
      putCaret(root, spot.current);
      block = window.getSelection()?.anchorNode ?? null;
      while (block && block.parentNode !== root) block = block.parentNode;
    }
    const pictures = urls.map((u) => {
      const p = document.createElement('p');
      const img = document.createElement('img');
      img.src = u;
      img.alt = '';
      p.append(img);
      return p;
    });
    const next = document.createElement('p');
    next.append(document.createElement('br'));
    if (block) (block as ChildNode).after(...pictures, next);
    else root.append(...pictures, next);
    // Carry on typing below the pictures.
    const r = document.createRange();
    r.setStart(next, 0);
    r.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
    spot.current = caretAt(root);
    sync();
  }

  async function uploadFiles(files: File[]) {
    const pictures = files.filter((f) => f.type.startsWith('image/'));
    if (!pictures.length || !productId) return;
    setProblem('');
    setBusy(`Uploading ${pictures.length} picture${pictures.length > 1 ? 's' : ''}…`);
    const urls: string[] = [];
    const errors: string[] = [];
    for (const file of pictures) {
      if (!productId) break;
      const r = await uploadProductPhoto(productId, file);
      if ('path' in r) urls.push(imageUrl(r.path)!);
      else errors.push(r.error);
    }
    setBusy('');
    setProblem(errors.join(' '));
    insertImages(urls);
  }

  async function addLink() {
    if (!link.trim()) return;
    setProblem('');
    setBusy('Copying the picture…');
    if (!productId) return;
    const r = await copyDescriptionImage(productId, link);
    setBusy('');
    if ('error' in r) return setProblem(r.error);
    setLink('');
    insertImages([r.url]);
  }

  function openImagePanel() {
    if (ref.current && ref.current.contains(window.getSelection()?.anchorNode ?? null)) spot.current = caretAt(ref.current);
    setProblem('');
    setImagePanel((o) => !o);
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
        {productId && <><span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <button type="button" title="Add a picture" aria-label="Add a picture" aria-expanded={imagePanel} onMouseDown={keep} onClick={openImagePanel} className={`${btn} !flex gap-1.5 ${imagePanel ? 'border-brand text-brand' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
          Picture
        </button></>}
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={`ml-auto rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${preview ? 'bg-night text-white' : 'border border-line bg-white hover:border-brand'}`}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
      </div>
      {imagePanel && (
        <div className="space-y-2 rounded-xl border border-line bg-soft/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy} className="btn btn-primary min-h-9 px-4 text-[12px]">From computer</button>
            <input ref={fileInput} type="file" accept={PHOTO_ACCEPT} multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void uploadFiles(f); }} />
            <span className="text-[13px] text-muted">or</span>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addLink(); } }}
              placeholder="Paste a picture link (https://…)"
              aria-label="Picture link"
              className="input min-h-9 min-w-0 flex-1 py-1.5"
            />
            <button type="button" onClick={() => void addLink()} disabled={!!busy || !link.trim()} className="btn btn-dark-outline min-h-9 px-4 text-[12px]">Add</button>
          </div>
          <p className="text-[12.5px] text-muted">You can also paste a copied picture (Ctrl+V) or drag pictures from your computer into the box. JPG, PNG, WebP or AVIF, up to 5 MB each.</p>
          {busy && <p className="text-[13px] font-semibold text-brand" role="status">{busy}</p>}
          {problem && <p className="text-[13px] font-semibold text-bad" role="alert">{problem}</p>}
        </div>
      )}
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
            e.preventDefault();
            // A copied picture (a screenshot, or "Copy image" in a browser): upload it.
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
            if (files.length) {
              spot.current = ref.current ? caretAt(ref.current) : null;
              void uploadFiles(files);
              return;
            }
            // Paste as text, formatted the same way (lists and headings in the pasted text are kept).
            const text = e.clipboardData.getData('text/plain');
            if (text.includes('\n')) run('insertHTML', descriptionToHtml(text));
            else run('insertText', text);
            sync();
          }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
            if (!files.length) return;
            e.preventDefault();
            const at = document.caretRangeFromPoint?.(e.clientX, e.clientY);
            if (at && ref.current) {
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(at);
              spot.current = caretAt(ref.current);
            }
            void uploadFiles(files);
          }}
          className="rte input min-h-48 overflow-auto"
        />
        {!value.trim() && <p className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-muted">{placeholder}</p>}
      </div>
      <input type="hidden" name="description" value={value} />
      {preview && plainPreview && (
        <div className="rte rounded-xl border border-dashed border-line bg-soft/60 p-4" aria-label="Preview" dangerouslySetInnerHTML={{ __html: descriptionToHtml(value) }} />
      )}
      {preview && !plainPreview && (
        <div className="space-y-5 rounded-xl border border-dashed border-line bg-soft/60 p-4" aria-label="Preview">
          {content.flow.length > 0 && <section><p className="mb-2 text-lg font-bold">About this item</p><DescriptionFlow flow={content.flow} /></section>}
          {content.specs.length > 0 && (
            <section>
              <p className="mb-2 text-lg font-bold">Product details</p>
              <ul className="space-y-1 text-[14px]">{content.specs.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul>
            </section>
          )}
          {!value.trim() && <p className="text-sm text-muted">Nothing to show yet.</p>}
        </div>
      )}
    </div>
  );
}
