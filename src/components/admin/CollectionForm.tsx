'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { deleteCollection, previewCollection, saveCollection, type PreviewProduct } from '@/actions/admin-collections';
import { RULE_FIELDS, type CollectionRow, type Rule, type RuleField } from '@/lib/collections';
import { slugify } from '@/lib/slug';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';

type PickProduct = { id: string; name: string; sku: string; image: string | null; status: string };
type PickCategory = { id: string; name: string; parent_id: string | null };

const firstOp = (f: RuleField) => Object.keys(RULE_FIELDS[f].ops)[0]!;

/**
 * Make or edit a collection: name and web address, rules (tag, category, name,
 * SKU, price) matched "any" or "all", products picked by hand, and a live list of
 * the products it holds right now.
 */
export function CollectionForm({ collection, categories, tags, products }: { collection?: CollectionRow; categories: PickCategory[]; tags: string[]; products: PickProduct[] }) {
  const router = useRouter();
  const [name, setName] = useState(collection?.name ?? '');
  const [slug, setSlug] = useState(collection?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!collection);
  const [description, setDescription] = useState(collection?.description ?? '');
  const [isPublic, setPublic] = useState(collection?.is_public ?? true);
  const [sortOrder, setSortOrder] = useState(collection?.sort_order ?? 0);
  const [match, setMatch] = useState<'any' | 'all'>(collection?.match ?? 'any');
  const [rules, setRules] = useState<Rule[]>(collection?.rules ?? [{ field: 'tag', op: 'is', value: '' }]);
  const [picked, setPicked] = useState<string[]>(collection?.product_ids ?? []);
  const [q, setQ] = useState('');
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [asking, setAsking] = useState(false);
  const [preview, setPreview] = useState<{ total: number; published: number; products: PreviewProduct[]; message?: string } | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const mothers = categories.filter((c) => !c.parent_id);

  // Live preview, a moment after the last change (rules still being typed are skipped).
  const ready = rules.filter((r) => r.value.trim());
  const key = JSON.stringify([match, ready, picked]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await previewCollection({ match, rules: ready, productIds: picked });
      setPreview(r.ok ? r : { total: 0, published: 0, products: [], message: r.message });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers match, rules and picked
  }, [key]);

  const setRule = (i: number, patch: Partial<Rule>) => setRules((cur) => cur.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p) => !picked.includes(p.id) && `${p.name} ${p.sku}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products, picked]);

  const save = () => startSave(async () => {
    const r = await saveCollection({ id: collection?.id, name, slug, description, isPublic, match, rules: ready, productIds: picked, sortOrder });
    if (r) { notify(r.ok, r.message); if (r.ok) router.refresh(); }
  });
  const remove = () => startDelete(async () => {
    const r = await deleteCollection(collection!.id);
    notify(r.ok, r.message);
    if (r.ok) router.push('/admin/collections');
  });

  const input = 'input h-10 text-[14px]';
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field"><span className="label">Name</span>
              <input value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} maxLength={80} placeholder="e.g. Eid Collection" className={input} />
            </label>
            <label className="field"><span className="label">Web address</span>
              <span className="flex items-center rounded-xl border border-line bg-white pl-3 text-[13px] text-muted focus-within:border-brand">/collections/
                <input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }} maxLength={80} className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-[14px] text-ink outline-none" />
              </span>
            </label>
            <label className="field sm:col-span-2"><span className="label">Description (optional, shown on the collection page)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className="input text-[14px]" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Visible on the website</label>
            <label className="flex items-center gap-2 text-sm"><span className="font-medium">Order</span><input type="number" value={sortOrder} onChange={(e) => setSortOrder(Math.max(-1000, Math.min(1000, Math.round(Number(e.target.value) || 0))))} className="input h-9 w-24" /><span className="text-[12px] text-muted">lower comes first</span></label>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-semibold">Products that match</h2>
            <span className="flex rounded-full border border-line p-0.5 text-[13px]">
              {(['any', 'all'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMatch(m)} className={`rounded-full px-3 py-1 font-semibold ${match === m ? 'bg-night text-white' : 'text-muted'}`}>{m === 'any' ? 'any rule' : 'all rules'}</button>
              ))}
            </span>
          </div>
          <ul className="space-y-2">
            {rules.map((r, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-xl border border-line p-2 sm:grid-cols-[10rem_9rem_minmax(0,1fr)_auto] sm:border-0 sm:p-0">
                <select value={r.field} onChange={(e) => { const field = e.target.value as RuleField; setRule(i, { field, op: firstOp(field), value: '' }); }} className={`${input} order-1`} aria-label="Rule">
                  {(Object.keys(RULE_FIELDS) as RuleField[]).map((f) => <option key={f} value={f}>{RULE_FIELDS[f].label}</option>)}
                </select>
                <select value={r.op} onChange={(e) => setRule(i, { op: e.target.value })} className={`${input} order-2`} aria-label="How">
                  {Object.entries(RULE_FIELDS[r.field].ops).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                {r.field === 'tag' ? (
                  <select value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} className={`${input} order-4 col-span-3 sm:order-3 sm:col-span-1`} aria-label="Tag">
                    <option value="">Choose a tag…</option>
                    {[...new Set([...tags, ...(r.value ? [r.value] : [])])].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : r.field === 'category' ? (
                  <select value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} className={`${input} order-4 col-span-3 sm:order-3 sm:col-span-1`} aria-label="Category">
                    <option value="">Choose a category…</option>
                    {mothers.map((m) => [
                      <option key={m.id} value={m.id}>{m.name}{categories.some((c) => c.parent_id === m.id) ? ' (all)' : ''}</option>,
                      ...categories.filter((c) => c.parent_id === m.id).map((c) => <option key={c.id} value={c.id}>  ↳ {c.name}</option>),
                    ])}
                  </select>
                ) : (
                  <input value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} inputMode={r.field === 'price' ? 'numeric' : undefined} maxLength={80} placeholder={r.field === 'price' ? '500' : r.field === 'sku' ? 'SKU-004' : 'scarf'} className={`${input} order-4 col-span-3 sm:order-3 sm:col-span-1`} aria-label="Value" />
                )}
                <button type="button" onClick={() => setRules((cur) => cur.filter((_, n) => n !== i))} aria-label="Remove rule" className="order-3 grid h-10 w-10 sm:order-4 place-items-center justify-self-end rounded-full text-bad hover:bg-bad/10"><Icon name="trash" size={16} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRules((cur) => [...cur, { field: 'tag', op: 'is', value: '' }])} disabled={rules.length >= 20} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add rule</button>
          <p className="text-[12.5px] text-muted">
            {match === 'any' ? 'A product is in the collection when it matches at least one rule.' : 'A product is in the collection only when it matches every rule.'} New products that match join by themselves.
          </p>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Products picked by hand <span className="font-normal text-muted">(always in, whatever the rules)</span></h2>
          {picked.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {picked.map((id) => {
                const p = byId.get(id);
                return (
                  <li key={id} className="flex items-center gap-3 p-2 text-[13.5px]">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={p?.image ?? null} alt="" sizes="40px" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate">{p?.name ?? 'Deleted product'}</span><span className="font-mono text-[11.5px] text-muted">{p?.sku}</span></span>
                    <button type="button" onClick={() => setPicked((cur) => cur.filter((x) => x !== id))} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full text-bad hover:bg-bad/10"><Icon name="x" size={14} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a product by name or SKU to add it" className={input} />
            {found.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
                {found.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setPicked((cur) => [...cur, p.id]); setQ(''); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-soft">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={p.image} alt="" sizes="36px" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate">{p.name}</span><span className="font-mono text-[11.5px] text-muted">{p.sku}{p.status !== 'published' ? ` · ${p.status}` : ''}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : collection ? 'Save collection' : 'Create collection'}</button>
          <Link href="/admin/collections" className="btn btn-outline">Back</Link>
          {collection && (
            <>
              <a href={`/collections/${collection.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-muted hover:text-brand">View on website ↗</a>
              <button type="button" onClick={() => setAsking(true)} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bad hover:underline"><Icon name="trash" size={15} /> Delete collection</button>
            </>
          )}
        </div>
      </div>

      <aside className="card h-fit space-y-3 p-5 xl:sticky xl:top-20">
        <h2 className="font-semibold">In this collection now</h2>
        {!preview ? <p className="text-sm text-muted">Checking…</p> : preview.message ? <p className="text-sm text-bad">{preview.message}</p> : (
          <>
            <p className="text-sm"><b className="text-lg">{preview.published}</b> on the website{preview.total > preview.published ? <span className="text-muted"> · {preview.total - preview.published} draft</span> : null}</p>
            {preview.products.length === 0 ? <p className="text-sm text-muted">No products match yet.</p> : (
              <ul className="grid grid-cols-4 gap-1.5">
                {preview.products.map((p) => (
                  <li key={p.id} title={`${p.name} · ${p.sku}${p.status !== 'published' ? ` (${p.status})` : ''}`} className={`relative aspect-square overflow-hidden rounded-lg bg-tint ${p.status !== 'published' ? 'opacity-40' : ''}`}>
                    <ProductImage path={p.image} alt={p.name} sizes="72px" />
                  </li>
                ))}
              </ul>
            )}
            {preview.total > preview.products.length && <p className="text-[12px] text-muted">+{preview.total - preview.products.length} more</p>}
          </>
        )}
      </aside>

      <ConfirmDialog open={asking} title={`Delete “${collection?.name}”?`} confirmLabel="Yes, delete" pendingLabel="Deleting…" pending={deleting} onConfirm={remove} onClose={() => setAsking(false)}>
        The collection page and any home page section using it stop showing these products. The products themselves are not touched.
      </ConfirmDialog>
    </div>
  );
}
