'use client';

import { useRef, useState, type ReactNode } from 'react';
import { FEATURE_ICONS, type FeatureIcon, type Showcase, type ShowcaseCard, type ShowcaseItem } from '@/lib/showcase';
import { PHOTO_ACCEPT, uploadHomeImage } from '@/lib/upload-photo';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';

type Set = (fn: (s: Showcase) => Showcase) => void;

/** Every word and photo of the Showcase template, part by part. */
export function ShowcaseEditor({ value, onChange, photos }: { value: Showcase; onChange: (s: Showcase) => void; photos: string[] }) {
  const set: Set = (fn) => onChange(fn(value));
  const s = value;
  const part = <K extends keyof Showcase>(k: K, patch: Partial<Showcase[K]>) => set((cur) => ({ ...cur, [k]: { ...cur[k], ...patch } }));

  return (
    <div className="space-y-3">
      <Part title="1. Top (hero)" hint="Dark box at the top: big title, short text, price and button">
        <Text label="Small line above the title (the offer badge is used if set)" value={s.hero.eyebrow} max={60} onChange={(v) => part('hero', { eyebrow: v })} />
        <Text label="Big title" value={s.hero.title} max={120} onChange={(v) => part('hero', { title: v })} placeholder="The product name if empty" />
        <Text label="Short text" value={s.hero.text} max={300} area onChange={(v) => part('hero', { text: v })} />
        <Text label="Button text" value={s.hero.button} max={40} onChange={(v) => part('hero', { button: v })} placeholder="Order now" />
        <Photo label="Photo" value={s.hero.image} photos={photos} onChange={(v) => part('hero', { image: v })} />
      </Part>

      <Part title="2. Main features" hint="List with icons beside a photo" on={s.features.on} onToggle={(on) => part('features', { on })}>
        <Text label="Small line" value={s.features.eyebrow} max={60} onChange={(v) => part('features', { eyebrow: v })} />
        <Text label="Title" value={s.features.title} max={120} onChange={(v) => part('features', { title: v })} />
        <Items items={s.features.items} max={8} onChange={(items) => part('features', { items })} />
        <Photo label="Photo" value={s.features.image} photos={photos} onChange={(v) => part('features', { image: v })} />
      </Part>

      <Part title="3. Wide photo" hint="A big photo across the page with a title" on={s.banner1.on} onToggle={(on) => part('banner1', { on })}>
        <Text label="Title" value={s.banner1.title} max={120} onChange={(v) => part('banner1', { title: v })} />
        <Text label="Text" value={s.banner1.text} max={400} area onChange={(v) => part('banner1', { text: v })} />
        <Photo label="Photo (wide)" value={s.banner1.image} photos={photos} onChange={(v) => part('banner1', { image: v })} />
      </Part>

      <Part title="4. Features around a photo" hint="Points on the left and right of a round photo" on={s.around.on} onToggle={(on) => part('around', { on })}>
        <Text label="Small line" value={s.around.eyebrow} max={60} onChange={(v) => part('around', { eyebrow: v })} />
        <Text label="Title" value={s.around.title} max={120} onChange={(v) => part('around', { title: v })} />
        <Text label="Text" value={s.around.text} max={400} area onChange={(v) => part('around', { text: v })} />
        <p className="label">Left side</p>
        <Items items={s.around.left} max={4} onChange={(left) => part('around', { left })} />
        <p className="label">Right side</p>
        <Items items={s.around.right} max={4} onChange={(right) => part('around', { right })} />
        <Photo label="Middle photo (shown round)" value={s.around.image} photos={photos} onChange={(v) => part('around', { image: v })} />
      </Part>

      <Part title="5. Second wide photo" on={s.banner2.on} onToggle={(on) => part('banner2', { on })}>
        <Text label="Small line" value={s.banner2.eyebrow} max={60} onChange={(v) => part('banner2', { eyebrow: v })} />
        <Text label="Title" value={s.banner2.title} max={120} onChange={(v) => part('banner2', { title: v })} />
        <Text label="Text" value={s.banner2.text} max={400} area onChange={(v) => part('banner2', { text: v })} />
        <Photo label="Photo (wide)" value={s.banner2.image} photos={photos} onChange={(v) => part('banner2', { image: v })} />
      </Part>

      <Part title="6. Photo cards" hint="Up to 6 photos, each with a title and text" on={s.cards.on} onToggle={(on) => part('cards', { on })}>
        <Text label="Small line" value={s.cards.eyebrow} max={60} onChange={(v) => part('cards', { eyebrow: v })} />
        <Text label="Title" value={s.cards.title} max={120} onChange={(v) => part('cards', { title: v })} />
        <Text label="Text" value={s.cards.text} max={400} area onChange={(v) => part('cards', { text: v })} />
        <Cards cards={s.cards.items} photos={photos} onChange={(items) => part('cards', { items })} />
      </Part>

      <Part title="7. Order box" hint="Price, colour / size and the order form">
        <Text label="Small line" value={s.buy.eyebrow} max={60} onChange={(v) => part('buy', { eyebrow: v })} />
        <Text label="Title" value={s.buy.title} max={120} onChange={(v) => part('buy', { title: v })} placeholder="The product name if empty" />
        <Text label="Text" value={s.buy.text} max={300} onChange={(v) => part('buy', { text: v })} />
      </Part>

      <Part title="8. Reviews" hint="Only real, approved reviews of this product show (none → hidden)">
        <Text label="Small line" value={s.reviews.eyebrow} max={60} onChange={(v) => part('reviews', { eyebrow: v })} />
        <Text label="Title" value={s.reviews.title} max={120} onChange={(v) => part('reviews', { title: v })} />
      </Part>

      <Part title="9. Contact" hint="Call and WhatsApp buttons with the shop phone" on={s.contact.on} onToggle={(on) => part('contact', { on })}>
        <Text label="Small line" value={s.contact.eyebrow} max={60} onChange={(v) => part('contact', { eyebrow: v })} />
        <Text label="Title" value={s.contact.title} max={120} onChange={(v) => part('contact', { title: v })} />
        <Text label="Text" value={s.contact.text} max={300} onChange={(v) => part('contact', { text: v })} />
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

function Text({ label, value, onChange, max, area, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; area?: boolean; placeholder?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} rows={2} placeholder={placeholder} className="input text-[14px]" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} className="input h-10 text-[14px]" />
      )}
    </label>
  );
}

/** Choose one of the product's photos, or upload another. */
function Photo({ label, value, photos, onChange, compact }: { label: string; value: string | null; photos: string[]; onChange: (v: string | null) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    const r = await uploadHomeImage(file);
    setBusy(false);
    if ('error' in r) setErr(r.error);
    else { onChange(r.path); setOpen(false); }
  }
  return (
    <div className="field">
      {!compact && <span className="label">{label}</span>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className={`relative shrink-0 overflow-hidden rounded-lg bg-soft ring-1 ring-line hover:ring-brand ${compact ? 'h-16 w-16' : 'h-20 w-20'}`} title="Choose a photo">
          {value ? <ProductImage path={value} alt="" sizes="80px" /> : <span className="grid h-full place-items-center text-muted"><Icon name="plus" size={18} /></span>}
          {busy && <span className="absolute inset-0 grid place-items-center bg-white/70 text-[11px]">Uploading…</span>}
        </button>
        <div className="flex flex-col items-start gap-1 text-[12.5px]">
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-semibold text-brand hover:underline">{value ? 'Change' : 'Choose photo'}</button>
          {value && <button type="button" onClick={() => onChange(null)} className="text-muted hover:underline">Remove</button>}
        </div>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-soft/50 p-2">
          <div className="flex flex-wrap gap-1.5">
            {photos.map((p) => (
              <button key={p} type="button" onClick={() => { onChange(p); setOpen(false); }} className={`relative h-14 w-14 overflow-hidden rounded-md ring-2 ${p === value ? 'ring-brand' : 'ring-transparent hover:ring-line'}`}>
                <ProductImage path={p} alt="" sizes="56px" />
              </button>
            ))}
            <button type="button" onClick={() => input.current?.click()} className="grid h-14 w-14 place-items-center rounded-md border-2 border-dashed border-brand/40 text-center text-[10.5px] font-semibold text-brand">Upload<br />new</button>
          </div>
          {photos.length === 0 && <p className="mt-1 text-[12px] text-muted">Choose the product first to pick from its photos.</p>}
        </div>
      )}
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function move<T>(xs: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const next = [...xs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function Items({ items, max, onChange }: { items: ShowcaseItem[]; max: number; onChange: (items: ShowcaseItem[]) => void }) {
  const edit = (i: number, patch: Partial<ShowcaseItem>) => onChange(items.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-line p-2">
          <IconPick value={it.icon} onChange={(icon) => edit(i, { icon })} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <input value={it.title} onChange={(e) => edit(i, { title: e.target.value })} maxLength={80} placeholder="Title, e.g. Soft fleece lining" className="input h-9 text-[13.5px]" />
            <input value={it.text} onChange={(e) => edit(i, { text: e.target.value })} maxLength={200} placeholder="Short text (optional)" className="input h-9 text-[13px]" />
          </div>
          <Order onUp={() => onChange(move(items, i, -1))} onDown={() => onChange(move(items, i, 1))} onRemove={() => onChange(items.filter((_, n) => n !== i))} />
        </div>
      ))}
      {items.length < max && <button type="button" onClick={() => onChange([...items, { icon: 'check', title: '', text: '' }])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add a point</button>}
    </div>
  );
}

function Cards({ cards, photos, onChange }: { cards: ShowcaseCard[]; photos: string[]; onChange: (cards: ShowcaseCard[]) => void }) {
  const edit = (i: number, patch: Partial<ShowcaseCard>) => onChange(cards.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {cards.map((c, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-line p-2">
          <Photo label="" compact value={c.image} photos={photos} onChange={(image) => edit(i, { image })} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <input value={c.title} onChange={(e) => edit(i, { title: e.target.value })} maxLength={80} placeholder="Title (optional)" className="input h-9 text-[13.5px]" />
            <textarea value={c.text} onChange={(e) => edit(i, { text: e.target.value })} maxLength={300} rows={2} placeholder="Text (optional)" className="input text-[13px]" />
          </div>
          <Order onUp={() => onChange(move(cards, i, -1))} onDown={() => onChange(move(cards, i, 1))} onRemove={() => onChange(cards.filter((_, n) => n !== i))} />
        </div>
      ))}
      {cards.length < 6 && <button type="button" onClick={() => onChange([...cards, { image: null, title: '', text: '' }])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add a card</button>}
    </div>
  );
}

function Order({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const b = 'grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:text-ink';
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button type="button" aria-label="Move up" onClick={onUp} className={b}><Icon name="arrow" size={12} className="-rotate-90" /></button>
      <button type="button" aria-label="Move down" onClick={onDown} className={b}><Icon name="arrow" size={12} className="rotate-90" /></button>
      <button type="button" aria-label="Remove" onClick={onRemove} className={`${b} hover:text-bad`}><Icon name="x" size={12} /></button>
    </div>
  );
}

function IconPick({ value, onChange }: { value: FeatureIcon; onChange: (v: FeatureIcon) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Choose an icon" className="grid h-9 w-9 place-items-center rounded-lg bg-tint text-brand ring-1 ring-line hover:ring-brand">
        <Icon name={value} size={18} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 grid w-56 grid-cols-6 gap-1 rounded-xl border border-line bg-white p-2 shadow-xl">
          {FEATURE_ICONS.map((n) => (
            <button key={n} type="button" title={n} onClick={() => { onChange(n); setOpen(false); }} className={`grid h-8 w-8 place-items-center rounded-md ${n === value ? 'bg-brand text-white' : 'text-ink hover:bg-soft'}`}>
              <Icon name={n} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
