'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { addHomeSection, deleteHomeSection, reorderHomeSections, saveHomeSection, setHomeSectionEnabled } from '@/actions/admin-home';
import { LABEL_FIELDS, PRODUCT_SOURCES, SECTION_INFO, SECTION_TYPES, SOURCE_LABEL, type HomeSection, type SectionSettings, type SectionType } from '@/lib/home-sections';
import { PHOTO_ACCEPT, uploadHomeImage } from '@/lib/upload-photo';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { useDragSort } from './useDragSort';

export type PickProduct = { id: string; name: string; sku: string; image: string | null; status: string };
export type PickCategory = { id: string; name: string };

type Ctx = { products: PickProduct[]; categories: PickCategory[] };

/**
 * Home page builder: every section of the shop's home page in order. Drag
 * the handle (or use the arrows) to move a section, flip the switch to show
 * or hide it, open it to edit its heading, pictures, links and products.
 */
export function HomeBuilder({ sections, products, categories, theme }: { sections: HomeSection[]; products: PickProduct[]; categories: PickCategory[]; theme: string }) {
  const [items, setItems] = useState(sections);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [newType, setNewType] = useState<SectionType>('collection');

  function persistOrder(next: HomeSection[]) {
    setItems(next);
    start(async () => {
      const r = await reorderHomeSections(next.map((s) => s.id));
      if (!r.ok) setMsg({ ok: false, text: r.message ?? 'Could not save the order.' });
    });
  }
  const { list, dragging, handlers } = useDragSort(items, persistOrder);

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    persistOrder(next);
  }

  function toggle(s: HomeSection, enabled: boolean) {
    setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, enabled } : x)));
    start(async () => {
      const r = await setHomeSectionEnabled(s.id, enabled);
      if (!r.ok) {
        setItems((cur) => cur.map((x) => (x.id === s.id ? { ...x, enabled: !enabled } : x)));
        setMsg({ ok: false, text: r.message ?? 'Could not change it.' });
      }
    });
  }

  function remove(s: HomeSection) {
    if (!window.confirm(`Delete the "${s.title || SECTION_INFO[s.type].label}" section? This cannot be undone.`)) return;
    start(async () => {
      const r = await deleteHomeSection(s.id);
      if (r.ok) setItems((cur) => cur.filter((x) => x.id !== s.id));
      setMsg({ ok: r.ok, text: r.message ?? '' });
    });
  }

  function add() {
    start(async () => {
      const r = await addHomeSection(newType, theme);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok && r.id) {
        // The server re-renders the page with the new row; open it once it arrives.
        setOpen(r.id);
      }
    });
  }

  // Keep in step with the server after add/delete re-renders.
  const ids = sections.map((s) => s.id).join();
  const seen = useRef(ids);
  if (seen.current !== ids) {
    seen.current = ids;
    setItems(sections);
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
          {msg.text}
        </p>
      )}

      <ol className="space-y-2.5">
        {list.map((s, i) => (
          <li key={s.id} data-sort-index={i} className={`card overflow-hidden transition ${dragging === i ? 'scale-[1.01] shadow-xl ring-2 ring-brand' : ''} ${s.enabled ? '' : 'opacity-75'}`}>
            <div className="flex items-center gap-2 p-3 sm:gap-3">
              <span {...handlers(i)} className="grid h-9 w-7 shrink-0 select-none place-items-center rounded-md text-muted hover:bg-soft" title="Drag to move" aria-hidden="true">⠿</span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-soft text-[12px] font-bold text-muted">{i + 1}</span>
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[14px] font-semibold">{s.title || SECTION_INFO[s.type].label}</span>
                <span className="block truncate text-[12px] text-muted">{SECTION_INFO[s.type].label}{summary(s)}</span>
              </button>
              <Switch checked={s.enabled} disabled={pending} onChange={(v) => toggle(s, v)} label={s.enabled ? 'On' : 'Off'} />
              <div className="hidden gap-1 sm:flex">
                <IconBtn label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)}><Icon name="arrow" size={15} className="-rotate-90" /></IconBtn>
                <IconBtn label="Move down" disabled={i === items.length - 1 || pending} onClick={() => move(i, 1)}><Icon name="arrow" size={15} className="rotate-90" /></IconBtn>
              </div>
              <IconBtn label={open === s.id ? 'Close' : 'Edit'} onClick={() => setOpen(open === s.id ? null : s.id)}><Icon name={open === s.id ? 'x' : 'pencil'} size={15} /></IconBtn>
            </div>
            {open === s.id && (
              <SectionEditor
                key={s.id}
                section={s}
                ctx={{ products, categories }}
                onSaved={(saved) => setItems((cur) => cur.map((x) => (x.id === saved.id ? saved : x)))}
                onDelete={() => remove(s)}
                onMove={(d) => move(i, d)}
                first={i === 0}
                last={i === items.length - 1}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="field min-w-56 flex-1">
          <label htmlFor="new-type" className="label">Add a section</label>
          <select id="new-type" value={newType} onChange={(e) => setNewType(e.target.value as SectionType)} className="input">
            {SECTION_TYPES.map((t) => <option key={t} value={t}>{SECTION_INFO[t].label}</option>)}
          </select>
          <p className="hint">{SECTION_INFO[newType].hint}</p>
        </div>
        <button type="button" onClick={add} disabled={pending} className="btn btn-primary"><Icon name="plus" size={16} /> Add section</button>
      </div>
    </div>
  );
}

function summary(s: HomeSection): string {
  const st = s.settings as Record<string, unknown>;
  if (s.type === 'collection' || s.type === 'product_row') {
    const src = st.source as keyof typeof SOURCE_LABEL;
    return ` · ${src === 'manual' ? `${(st.product_ids as string[]).length} chosen products` : SOURCE_LABEL[src]}`;
  }
  if (s.type === 'hero') return ` · ${(st.slides as unknown[]).length} slide(s)`;
  if (s.type === 'banners') return ` · ${(st.items as unknown[]).length} banner(s)`;
  if (s.type === 'quick_links') return ` · ${(st.links as unknown[]).length} link(s)`;
  return '';
}

// ------------------------------------------------------------- editor

function SectionEditor({ section, ctx, onSaved, onDelete, onMove, first, last }: {
  section: HomeSection; ctx: Ctx; onSaved: (s: HomeSection) => void; onDelete: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean;
}) {
  const [title, setTitle] = useState(section.title ?? '');
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '');
  const [enabled, setEnabled] = useState(section.enabled);
  const [settings, setSettings] = useState(section.settings as Record<string, unknown>);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Record<string, unknown>) => setSettings((cur) => ({ ...cur, ...patch }));
  const t = section.type;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveHomeSection({ id: section.id, title, subtitle, enabled, settings });
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) onSaved({ ...section, title: title || null, subtitle: subtitle || null, enabled, settings: settings as never });
    });
  }

  const showTitle = t !== 'quick_links' && t !== 'benefits' && t !== 'notice';
  const titleLabel = t === 'banners' ? 'Small line above the banner (e.g. LIMITED EDITION)' : t === 'testimonials' ? 'Heading over the customer comments' : 'Heading';
  const subtitleLabel = t === 'notice' ? 'Notice text' : t === 'about' ? 'Story text' : 'Short text under the heading (optional)';

  return (
    <div className="space-y-5 border-t border-line bg-soft/60 p-4 sm:p-5">
      <p className="text-[12.5px] text-muted">{SECTION_INFO[t].hint}</p>

      {(showTitle || t === 'notice') && (
        <div className="grid gap-4 md:grid-cols-2">
          {showTitle && (
            <div className="field">
              <label className="label" htmlFor={`t-${section.id}`}>{titleLabel}</label>
              <input id={`t-${section.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input" />
            </div>
          )}
          {t !== 'banners' && t !== 'testimonials' && t !== 'gallery' && <div className={`field ${t === 'notice' ? 'md:col-span-2' : ''}`}>
            <label className="label" htmlFor={`s-${section.id}`}>{subtitleLabel}</label>
            <textarea id={`s-${section.id}`} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={600} rows={t === 'about' ? 4 : 2} className="input" />
          </div>}
        </div>
      )}

      {t === 'hero' && <HeroEditor settings={settings as SectionSettings['hero']} set={set} />}
      {t === 'quick_links' && (
        <ListEditor
          title="Links"
          items={(settings as SectionSettings['quick_links']).links}
          max={10}
          blank={{ label: '', href: '' }}
          onChange={(links) => set({ links })}
          render={(l, update) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input value={l.label} onChange={(e) => update({ ...l, label: e.target.value })} placeholder="Label, e.g. Men" maxLength={40} className="input" />
              <LinkInput value={l.href} onChange={(href) => update({ ...l, href })} />
            </div>
          )}
        />
      )}
      {t === 'notice' && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Link text (optional)" value={(settings as SectionSettings['notice']).link_label} onChange={(link_label) => set({ link_label })} max={40} />
          <div className="field"><span className="label">Link (optional)</span><LinkInput value={(settings as SectionSettings['notice']).link} onChange={(link) => set({ link })} /></div>
        </div>
      )}
      {t === 'benefits' && <p className="text-[13px] text-muted">These cards come from Settings (cash on delivery, free delivery threshold, return days). Rename any of them under “Button & label texts” below.</p>}
      {t === 'category_tiles' && <CategoryPicker ids={(settings as SectionSettings['category_tiles']).category_ids} categories={ctx.categories} onChange={(category_ids) => set({ category_ids })} />}
      {t === 'product_row' && (
        <div className="field max-w-xs">
          <span className="label">Show as</span>
          <select value={(settings as SectionSettings['product_row']).layout} onChange={(e) => set({ layout: e.target.value })} className="input">
            <option value="row">Slider (one row)</option>
            <option value="grid">Grid with a View all button</option>
          </select>
        </div>
      )}
      {(t === 'collection' || t === 'product_row') && (
        <ProductListEditor settings={settings as SectionSettings['collection']} set={set} ctx={ctx} withImage={t === 'collection'} autoplay={t === 'product_row' ? (settings as SectionSettings['product_row']).autoplay : undefined} />
      )}
      {t === 'deal' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Small text above the heading, e.g. Limited offer" value={(settings as SectionSettings['deal']).eyebrow} onChange={(eyebrow) => set({ eyebrow })} max={40} />
            <div className="field">
              <span className="label">Offer ends at (optional)</span>
              <input
                type="datetime-local"
                value={toLocalInput((settings as SectionSettings['deal']).ends_at)}
                onChange={(e) => set({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="input"
              />
              <span className="hint">The countdown shows only until this time. Leave empty for no timer.</span>
            </div>
          </div>
          <ProductListEditor settings={{ ...(settings as SectionSettings['deal']), image: null }} set={set} ctx={ctx} withImage={false} />
        </div>
      )}
      {t === 'newsletter' && <p className="text-[13px] text-muted">Only the heading and small text above are needed. Emails people leave are saved to your subscriber list.</p>}
      {t === 'banners' && (
        <ListEditor
          title="Banners (up to 3, shown side by side)"
          items={(settings as SectionSettings['banners']).items}
          max={3}
          blank={{ image: null, title: '', subtitle: '', link: '' }}
          onChange={(items) => set({ items })}
          render={(b, update) => (
            <div className="grid flex-1 gap-3 md:grid-cols-[10rem_1fr]">
              <ImageField value={b.image} onChange={(image) => update({ ...b, image })} aspect="aspect-[16/9]" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={b.title} onChange={(e) => update({ ...b, title: e.target.value })} placeholder="Title (optional)" maxLength={80} className="input" />
                <input value={b.subtitle} onChange={(e) => update({ ...b, subtitle: e.target.value })} placeholder="Small text (optional)" maxLength={160} className="input" />
                <div className="sm:col-span-2"><LinkInput value={b.link} onChange={(link) => update({ ...b, link })} /></div>
              </div>
            </div>
          )}
        />
      )}
      {t === 'testimonials' && (
        <div className="space-y-5">
          <TextField label="Heading over the products (left)" value={(settings as SectionSettings['testimonials']).products_title} onChange={(products_title) => set({ products_title })} max={80} />
          <ProductListEditor settings={{ ...(settings as SectionSettings['testimonials']), link: '', image: null }} set={set} ctx={ctx} withImage={false} />
          <ListEditor
            title="Customer comments (only real ones, with the customer's permission)"
            items={(settings as SectionSettings['testimonials']).items}
            max={12}
            blank={{ quote: '', name: '', place: '', rating: 5 }}
            onChange={(items) => set({ items })}
            render={(r, update) => (
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_10rem_10rem_6rem]">
                <textarea value={r.quote} onChange={(e) => update({ ...r, quote: e.target.value })} placeholder="What the customer said" maxLength={400} rows={2} className="input sm:col-span-4" />
                <input value={r.name} onChange={(e) => update({ ...r, name: e.target.value })} placeholder="Name" maxLength={60} className="input" />
                <input value={r.place} onChange={(e) => update({ ...r, place: e.target.value })} placeholder="City (optional)" maxLength={60} className="input" />
                <span />
                <select value={r.rating} onChange={(e) => update({ ...r, rating: Number(e.target.value) })} className="input" aria-label="Stars">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
            )}
          />
        </div>
      )}
      {t === 'gallery' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Account name under the heading (e.g. @sidraa.bd)" value={(settings as SectionSettings['gallery']).handle} onChange={(handle) => set({ handle })} max={60} />
            <div className="field"><span className="label">"Follow us" link (Facebook / Instagram)</span><LinkInput value={(settings as SectionSettings['gallery']).handle_link} onChange={(handle_link) => set({ handle_link })} /></div>
          </div>
          <ListEditor
            title="Photos (up to 12, square works best). Without any, your newest product photos are shown."
            items={(settings as SectionSettings['gallery']).images}
            max={12}
            blank={{ image: null, link: '' }}
            onChange={(images) => set({ images })}
            render={(g, update) => (
              <div className="grid flex-1 gap-3 sm:grid-cols-[8rem_1fr]">
                <ImageField value={g.image} onChange={(image) => update({ ...g, image })} aspect="aspect-square" />
                <div><LinkInput value={g.link} onChange={(link) => update({ ...g, link })} /></div>
              </div>
            )}
          />
        </div>
      )}
      {t === 'about' && (
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="field"><span className="label">Photo (optional)</span><ImageField value={(settings as SectionSettings['about']).image} onChange={(image) => set({ image })} aspect="aspect-[4/3]" /></div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <TextField label="Button text" value={(settings as SectionSettings['about']).link_label} onChange={(link_label) => set({ link_label })} max={40} />
            <div className="field"><span className="label">Button link</span><LinkInput value={(settings as SectionSettings['about']).link} onChange={(link) => set({ link })} /></div>
          </div>
        </div>
      )}

      {LABEL_FIELDS[t] && (
        <LabelsEditor fields={LABEL_FIELDS[t]!} value={(settings as { labels?: Record<string, string> }).labels ?? {}} onChange={(labels) => set({ labels })} />
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary">{pending ? 'Saving…' : 'Save section'}</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Show on the home page</label>
        <div className="flex gap-1 sm:hidden">
          <IconBtn label="Move up" disabled={first} onClick={() => onMove(-1)}><Icon name="arrow" size={15} className="-rotate-90" /></IconBtn>
          <IconBtn label="Move down" disabled={last} onClick={() => onMove(1)}><Icon name="arrow" size={15} className="rotate-90" /></IconBtn>
        </div>
        <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-bad hover:underline"><Icon name="trash" size={15} /> Delete section</button>
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{msg.text}</p>}
    </div>
  );
}

function HeroEditor({ settings, set }: { settings: SectionSettings['hero']; set: (p: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <ListEditor
        title="Slides (photos). Without any, the brand gradient with the heading above is shown."
        items={settings.slides}
        max={8}
        blank={{ image: null, title: '', subtitle: '', button: '', link: '' }}
        onChange={(slides) => set({ slides })}
        render={(s, update) => (
          <div className="grid flex-1 gap-3 md:grid-cols-[12rem_1fr]">
            <ImageField value={s.image} onChange={(image) => update({ ...s, image })} aspect="aspect-[21/8]" hint="Wide photo, about 2100 × 800" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={s.title} onChange={(e) => update({ ...s, title: e.target.value })} placeholder="Big text on the photo (optional)" maxLength={120} className="input sm:col-span-2" />
              <input value={s.subtitle} onChange={(e) => update({ ...s, subtitle: e.target.value })} placeholder="Small text (optional)" maxLength={200} className="input" />
              <input value={s.button} onChange={(e) => update({ ...s, button: e.target.value })} placeholder="Button text (optional)" maxLength={30} className="input" />
              <div className="sm:col-span-2"><LinkInput value={s.link} onChange={(link) => update({ ...s, link })} /></div>
            </div>
          </div>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Button text (gradient banner)" value={settings.button} onChange={(button) => set({ button })} max={30} />
        <div className="field"><span className="label">Button link (gradient banner)</span><LinkInput value={settings.link} onChange={(link) => set({ link })} /></div>
      </div>
    </div>
  );
}

function ProductListEditor({ settings, set, ctx, withImage, autoplay }: { settings: Pick<SectionSettings['collection'], 'source' | 'category_id' | 'product_ids' | 'limit' | 'link' | 'image'>; set: (p: Record<string, unknown>) => void; ctx: Ctx; withImage: boolean; autoplay?: boolean }) {
  return (
    <div className="space-y-4">
      {autoplay !== undefined && (
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={autoplay} onChange={(e) => set({ autoplay: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" /> Scroll by itself (pauses when a visitor touches it)</label>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="field">
          <span className="label">Which products</span>
          <select value={settings.source} onChange={(e) => set({ source: e.target.value })} className="input">
            {PRODUCT_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </div>
        {settings.source === 'category' && (
          <div className="field">
            <span className="label">Category</span>
            <select value={settings.category_id ?? ''} onChange={(e) => set({ category_id: e.target.value || null })} className="input">
              <option value="">Choose…</option>
              {ctx.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <span className="label">How many to show</span>
          <input type="number" min={1} max={24} value={settings.limit} onChange={(e) => set({ limit: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })} className="input" />
          {withImage && <span className="hint">7 fills the grid next to the photo.</span>}
        </div>
        <div className="field"><span className="label">&ldquo;View all&rdquo; link</span><LinkInput value={settings.link} onChange={(link) => set({ link })} /></div>
      </div>
      {withImage && (
        <div className="field max-w-sm">
          <span className="label">Feature photo (optional — the first product&apos;s photo otherwise)</span>
          <ImageField value={settings.image} onChange={(image) => set({ image })} aspect="aspect-square" />
        </div>
      )}
      {settings.source === 'manual' && <ProductPicker ids={settings.product_ids} products={ctx.products} onChange={(product_ids) => set({ product_ids })} />}
    </div>
  );
}

function ProductPicker({ ids, products, onChange }: { ids: string[]; products: PickProduct[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const byId = new Map(products.map((p) => [p.id, p]));
  const term = q.trim().toLowerCase();
  const results = term ? products.filter((p) => !ids.includes(p.id) && (p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))).slice(0, 8) : [];
  const moveTo = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="field">
        <span className="label">Find products to add</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="input" />
        <ul className="mt-1 space-y-1">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange([...ids, p.id]); setQ(''); }} className="flex w-full items-center gap-2.5 rounded-lg bg-card p-1.5 text-left ring-1 ring-line hover:ring-brand">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-soft"><ProductImage path={p.image} alt="" sizes="40px" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.name}</span><span className="text-[11.5px] text-muted">{p.sku}{p.status !== 'published' ? ` · ${p.status}` : ''}</span></span>
                <Icon name="plus" size={16} className="text-brand" />
              </button>
            </li>
          ))}
          {term && results.length === 0 && <li className="text-[13px] text-muted">Nothing found (or already added).</li>}
        </ul>
      </div>
      <div className="field">
        <span className="label">Shown in this order ({ids.length})</span>
        {ids.length === 0 ? <p className="rounded-lg bg-card p-3 text-[13px] text-muted ring-1 ring-line">No products yet. Search and add on the left.</p> : (
          <ol className="space-y-1">
            {ids.map((id, i) => {
              const p = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-card p-1.5 ring-1 ring-line">
                  <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-soft"><ProductImage path={p?.image} alt="" sizes="40px" /></span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p ? p.name : 'Deleted product'}{p && p.status !== 'published' && <span className="text-warn"> · {p.status} (hidden in shop)</span>}</span>
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => moveTo(i, -1)}><Icon name="arrow" size={14} className="-rotate-90" /></IconBtn>
                  <IconBtn label="Move down" disabled={i === ids.length - 1} onClick={() => moveTo(i, 1)}><Icon name="arrow" size={14} className="rotate-90" /></IconBtn>
                  <IconBtn label="Remove" onClick={() => onChange(ids.filter((x) => x !== id))}><Icon name="x" size={14} /></IconBtn>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function CategoryPicker({ ids, categories, onChange }: { ids: string[]; categories: PickCategory[]; onChange: (ids: string[]) => void }) {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const moveTo = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <fieldset className="field">
        <legend className="label mb-1.5">Categories to show (none ticked = all, in their usual order)</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = ids.includes(c.id);
            return (
              <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[13px] ring-1 ${on ? 'bg-tint text-brand-ink ring-brand' : 'bg-card ring-line'}`}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? ids.filter((x) => x !== c.id) : [...ids, c.id])} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                {c.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      {ids.length > 0 && (
        <div className="field">
          <span className="label">Order</span>
          <ol className="space-y-1">
            {ids.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5 ring-1 ring-line">
                <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                <span className="flex-1 text-[13px]">{name.get(id) ?? 'Deleted category'}</span>
                <IconBtn label="Move up" disabled={i === 0} onClick={() => moveTo(i, -1)}><Icon name="arrow" size={14} className="-rotate-90" /></IconBtn>
                <IconBtn label="Move down" disabled={i === ids.length - 1} onClick={() => moveTo(i, 1)}><Icon name="arrow" size={14} className="rotate-90" /></IconBtn>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------- small pieces

function ListEditor<T>({ title, items, max, blank, onChange, render }: {
  title: string; items: T[]; max: number; blank: T; onChange: (items: T[]) => void; render: (item: T, update: (next: T) => void) => ReactNode;
}) {
  const moveTo = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="label">{title}</p>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-line sm:flex-row sm:items-start">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-soft text-[12px] font-bold text-muted">{i + 1}</span>
          {render(item, (next) => onChange(items.map((x, n) => (n === i ? next : x))))}
          <div className="flex gap-1 sm:flex-col">
            <IconBtn label="Move up" disabled={i === 0} onClick={() => moveTo(i, -1)}><Icon name="arrow" size={14} className="-rotate-90" /></IconBtn>
            <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => moveTo(i, 1)}><Icon name="arrow" size={14} className="rotate-90" /></IconBtn>
            <IconBtn label="Remove" onClick={() => onChange(items.filter((_, n) => n !== i))}><Icon name="trash" size={14} /></IconBtn>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, structuredClone(blank)])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add</button>
      )}
    </div>
  );
}

function ImageField({ value, onChange, aspect, hint }: { value: string | null; onChange: (v: string | null) => void; aspect: string; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const r = await uploadHomeImage(file);
    setBusy(false);
    if ('error' in r) setErr(r.error);
    else onChange(r.path);
  }
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => input.current?.click()} className={`relative block w-full overflow-hidden rounded-lg bg-soft ring-1 ring-line hover:ring-brand ${aspect}`}>
        {value ? <ProductImage path={value} alt="" sizes="200px" /> : <span className="grid h-full place-items-center text-[12px] text-muted"><span className="flex flex-col items-center gap-1"><Icon name="plus" size={18} />{busy ? 'Uploading…' : 'Upload photo'}</span></span>}
        {busy && value && <span className="absolute inset-0 grid place-items-center bg-white/70 text-[12px]">Uploading…</span>}
      </button>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex gap-3 text-[12px]">
        {value && <button type="button" onClick={() => input.current?.click()} className="font-semibold text-brand hover:underline">Change</button>}
        {value && <button type="button" onClick={() => onChange(null)} className="text-muted hover:underline">Remove</button>}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function LinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/products, /category/dresses or https://…" maxLength={300} className="input font-mono text-[13px]" />;
}

function TextField({ label, value, onChange, max }: { label: string; value: string; onChange: (v: string) => void; max: number }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} className="input" />
    </label>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-card hover:border-brand hover:text-brand disabled:opacity-35">
      {children}
    </button>
  );
}

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="flex shrink-0 items-center gap-1.5 disabled:opacity-60">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-ok' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
      <span className={`hidden w-6 text-[12px] font-semibold sm:block ${checked ? 'text-ok' : 'text-muted'}`}>{label}</span>
    </button>
  );
}

/** ISO time → the value a datetime-local input expects, in the admin's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Renames a section's buttons, badges and small texts; blank keeps the text shown in grey. */
function LabelsEditor({ fields, value, onChange }: { fields: { key: string; name: string; fallback: string }[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const filled = fields.filter((f) => value[f.key]?.trim()).length;
  return (
    <details className="rounded-xl border border-line bg-soft/40 p-3" open={filled > 0}>
      <summary className="cursor-pointer text-sm font-semibold">Button &amp; label texts {filled > 0 && <span className="badge ml-1">{filled} changed</span>}</summary>
      <p className="mt-1 text-[12.5px] text-muted">Type your own words; leave a box empty to keep the text shown in grey.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="field">
            <span className="label">{f.name}</span>
            <input
              value={value[f.key] ?? ''}
              placeholder={f.fallback}
              maxLength={60}
              onChange={(e) => {
                const next = { ...value, [f.key]: e.target.value };
                if (!e.target.value) delete next[f.key];
                onChange(next);
              }}
              className="input"
            />
          </label>
        ))}
      </div>
    </details>
  );
}
