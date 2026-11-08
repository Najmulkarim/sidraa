'use client';

import { useRef, useState, type ReactNode } from 'react';
import { STORY_DEFAULTS, type Story, type StoryBlock } from '@/lib/story';
import { PHOTO_ACCEPT, uploadHomeImage } from '@/lib/upload-photo';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';

const MARKS = ['✔', '✅', '🌿', '⭐', '❤️', '🔸', '👉', '🥇', '🎁', '💯'];

function move<T>(xs: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const next = [...xs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Every word and photo of the Story template. */
export function StoryEditor({ value, onChange, photos }: { value: Story; onChange: (s: Story) => void; photos: string[] }) {
  const s = value;
  const set = <K extends keyof Story>(k: K, v: Story[K]) => onChange({ ...s, [k]: v });
  const editBlock = (i: number, patch: Partial<StoryBlock>) => set('blocks', s.blocks.map((b, n) => (n === i ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-3">
      <Part title="1. Top buttons" hint="Photos, name and price come from the product">
        <div className="grid gap-3 sm:grid-cols-3">
          <Text label="Order button" value={s.top.order} max={40} placeholder={STORY_DEFAULTS.order} onChange={(v) => set('top', { ...s.top, order: v })} />
          <Text label="WhatsApp button" value={s.top.whatsapp} max={40} placeholder={STORY_DEFAULTS.whatsapp} onChange={(v) => set('top', { ...s.top, whatsapp: v })} />
          <Text label="Call button" value={s.top.call} max={40} placeholder={STORY_DEFAULTS.call} onChange={(v) => set('top', { ...s.top, call: v })} />
        </div>
      </Part>

      <Part title="2. The product’s story" hint="A big title, then blocks: each with a heading, text and a list">
        <Text label="Big title (emoji allowed)" value={s.title} max={200} onChange={(v) => set('title', v)} placeholder="e.g. 🌿 ঘরের স্বাদে খাঁটি …" />
        {s.blocks.map((b, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-start gap-2">
              <input value={b.title} onChange={(e) => editBlock(i, { title: e.target.value })} maxLength={100} placeholder="Block heading, e.g. উপকারিতা" className="input h-10 flex-1 text-[14px] font-semibold" />
              <Order onUp={() => set('blocks', move(s.blocks, i, -1))} onDown={() => set('blocks', move(s.blocks, i, 1))} onRemove={() => set('blocks', s.blocks.filter((_, n) => n !== i))} />
            </div>
            <textarea value={b.text} onChange={(e) => editBlock(i, { text: e.target.value })} maxLength={2000} rows={3} placeholder="Text (optional)" className="input text-[14px]" />
            <div className="space-y-1.5">
              {b.points.map((p, n) => (
                <div key={n} className="flex items-center gap-2">
                  <select value={MARKS.includes(p.mark) ? p.mark : '✔'} onChange={(e) => editBlock(i, { points: b.points.map((x, m) => (m === n ? { ...x, mark: e.target.value } : x)) })} aria-label="Mark" className="input h-9 w-16 px-1 text-center text-[15px]">
                    {MARKS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={p.text} onChange={(e) => editBlock(i, { points: b.points.map((x, m) => (m === n ? { ...x, text: e.target.value } : x)) })} maxLength={240} placeholder="A point" className="input h-9 flex-1 text-[13.5px]" />
                  <button type="button" aria-label="Remove point" onClick={() => editBlock(i, { points: b.points.filter((_, m) => m !== n) })} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-bad"><Icon name="x" size={14} /></button>
                </div>
              ))}
              {b.points.length < 15 && <button type="button" onClick={() => editBlock(i, { points: [...b.points, { mark: b.points.at(-1)?.mark ?? '✔', text: '' }] })} className="text-[13px] font-semibold text-brand hover:underline">+ Add a point</button>}
            </div>
          </div>
        ))}
        {s.blocks.length < 10 && <button type="button" onClick={() => set('blocks', [...s.blocks, { title: '', text: '', points: [] }])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add a block</button>}
      </Part>

      <Part title="3. Big photos (posters)" hint="Shown one under another at full width, in this order">
        <Posters value={s.images} photos={photos} onChange={(v) => set('images', v)} />
      </Part>

      <Part title="4. Order form heading">
        <Text label="Title" value={s.order.title} max={120} placeholder={STORY_DEFAULTS.orderTitle} onChange={(v) => set('order', { ...s.order, title: v })} />
        <Text label="Text" value={s.order.text} max={300} placeholder={STORY_DEFAULTS.orderText} onChange={(v) => set('order', { ...s.order, text: v })} />
      </Part>

      <Part title="5. Call band" hint="Call and WhatsApp buttons with the shop phone" on={s.contact.on} onToggle={(on) => set('contact', { ...s.contact, on })}>
        <Text label="Title" value={s.contact.title} max={120} placeholder={STORY_DEFAULTS.contactTitle} onChange={(v) => set('contact', { ...s.contact, title: v })} />
        <Text label="Text" value={s.contact.text} max={300} placeholder={STORY_DEFAULTS.contactText} onChange={(v) => set('contact', { ...s.contact, text: v })} />
      </Part>
    </div>
  );
}

function Part({ title, hint, on, onToggle, children }: { title: string; hint?: string; on?: boolean; onToggle?: (on: boolean) => void; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <Icon name="arrow" size={15} className="shrink-0 text-muted transition group-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${on === false ? 'text-muted line-through' : ''}`}>{title}</span>
          {hint && <span className="block text-[12px] text-muted">{hint}</span>}
        </span>
        {onToggle && (
          <label className="flex items-center gap-1.5 text-[12px] font-semibold" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Show
          </label>
        )}
      </summary>
      <div className="space-y-3 border-t border-line p-4">{children}</div>
    </details>
  );
}

function Text({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} className="input h-10 text-[14px]" />
    </label>
  );
}

function Order({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const b = 'grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:text-ink';
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" aria-label="Move up" onClick={onUp} className={b}><Icon name="arrow" size={12} className="-rotate-90" /></button>
      <button type="button" aria-label="Move down" onClick={onDown} className={b}><Icon name="arrow" size={12} className="rotate-90" /></button>
      <button type="button" aria-label="Remove" onClick={onRemove} className={`${b} hover:text-bad`}><Icon name="trash" size={13} /></button>
    </div>
  );
}

/** The poster list: add from the product's photos or upload; reorder; remove. */
function Posters({ value, photos, onChange }: { value: string[]; photos: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, 12 - value.length)) {
      const r = await uploadHomeImage(f);
      if ('error' in r) setErr(r.error);
      else added.push(r.path);
    }
    setBusy(false);
    onChange([...value, ...added]);
  }
  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-[13px] text-muted">No posters yet.</p>}
      <ol className="space-y-1.5">
        {value.map((p, i) => (
          <li key={`${p}-${i}`} className="flex items-center gap-2 rounded-lg border border-line p-1.5">
            <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-soft"><ProductImage path={p} alt="" sizes="56px" /></span>
            <span className="flex-1" />
            <Order onUp={() => onChange(move(value, i, -1))} onDown={() => onChange(move(value, i, 1))} onRemove={() => onChange(value.filter((_, n) => n !== i))} />
          </li>
        ))}
      </ol>
      {value.length < 12 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> From product photos</button>
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-outline btn-sm">{busy ? 'Uploading…' : 'Upload posters'}</button>
        </div>
      )}
      {open && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-soft/50 p-2">
          {photos.length === 0 && <p className="text-[12px] text-muted">Choose the product first.</p>}
          {photos.map((p) => (
            <button key={p} type="button" onClick={() => onChange([...value, p].slice(0, 12))} className="relative h-14 w-14 overflow-hidden rounded-md ring-2 ring-transparent hover:ring-brand" title="Add">
              <ProductImage path={p} alt="" sizes="56px" />
            </button>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
      {err && <p className="error">{err}</p>}
    </div>
  );
}
