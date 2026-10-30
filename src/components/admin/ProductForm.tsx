'use client';

import Link from 'next/link';
import { useState } from 'react';
import { saveProduct } from '@/actions/admin-catalog';
import { slugify } from '@/lib/slug';
import type { Category, Product, ProductImage as ProductImageRow, Variant } from '@/lib/types';
import { combinations, splitValues } from '@/lib/variations';
import { ProductImage } from '../shop/ProductImage';
import { DiscountFields } from './DiscountFields';
import { StockOutFields } from './StockOutFields';
import { useDragSort } from './useDragSort';
import { NewProductPhotos, type PendingPhoto } from './NewProductPhotos';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

type VariantRow = {
  key: string;
  id?: string;
  sku: string;
  color: string;
  size: string;
  option3: string;
  imagePath: string | null;
  price: string;
  cost: string;
  isActive: boolean;
  stock?: number;
  openingStock: string;
};

let seq = 0;
const newKey = () => `new-${++seq}`;
const blankRow = (): VariantRow => ({ key: newKey(), sku: '', color: '', size: '', option3: '', imagePath: null, price: '', cost: '', isActive: true, openingStock: '0' });

function toRow(v: Variant, cost?: number): VariantRow {
  return {
    key: v.id,
    id: v.id,
    sku: v.sku,
    color: v.color,
    size: v.size,
    option3: v.option3 ?? '',
    imagePath: v.image_path ?? null,
    price: v.price === null ? '' : String(v.price),
    cost: cost === undefined ? '' : String(cost),
    isActive: v.is_active,
    stock: v.stock,
    openingStock: '0',
  };
}

const same = (a: { color: string; size: string; option3: string }, b: { color: string; size: string; option3: string }) =>
  a.color.toLowerCase() === b.color.toLowerCase() && a.size.toLowerCase() === b.size.toLowerCase() && a.option3.toLowerCase() === b.option3.toLowerCase();

/** costs: the product's cost price and per-variation costs (staff-only data). */
export function ProductForm({ product, variants, categories, images = [], costs }: { product?: Product; variants?: Variant[]; categories: Category[]; images?: ProductImageRow[]; costs?: { product: number | null; variants: Record<string, number> } }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveProduct);
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [labels, setLabels] = useState({ color: product?.color_label ?? 'Color', size: product?.size_label ?? 'Size', option3: product?.option3_label ?? '' });
  const [rows, setRows] = useState<VariantRow[]>(variants && variants.length > 0 ? variants.map((v) => toRow(v, costs?.variants[v.id])) : [blankRow()]);
  const [gen, setGen] = useState({ colors: '', sizes: '', options: '' });
  const [picking, setPicking] = useState<string | null>(null);
  // New products get their id now, so photos can be uploaded before the first save.
  const [newId] = useState(() => (product ? '' : crypto.randomUUID()));
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  const photoOptions: ProductImageRow[] = product ? images : newPhotos.map((ph, i) => ({ id: ph.path, storage_path: ph.path, alt: ph.alt || null, sort_order: i }));
  const [applyToColor, setApplyToColor] = useState(true);
  const fe = state.fieldErrors ?? {};
  const showOption3 = !!labels.option3 || rows.some((r) => r.option3);

  // Rows stay in the automatic order until someone drags one; from then on the dragged order is saved.
  const [arranged, setArranged] = useState(() => !!variants?.some((v) => v.sort_order > 0));
  const rowDrag = useDragSort(rows, (next) => { setRows(next); setArranged(true); }, { handleOnlyTouch: true });

  const update = (key: string, patch: Partial<VariantRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const variantsJson = JSON.stringify(
    rows.map((r, i) => ({
      id: r.id ?? '',
      sku: r.sku,
      size: r.size,
      color: r.color,
      option3: r.option3,
      imagePath: r.imagePath ?? '',
      price: r.price === '' ? null : r.price,
      cost: r.cost === '' ? null : r.cost,
      isActive: r.isActive,
      sortOrder: arranged ? i + 1 : 0,
      openingStock: r.id ? 0 : Number(r.openingStock) || 0,
    })),
  );

  /** Adds every missing colour × size × option combination. */
  function createCombinations() {
    const combos = combinations(splitValues(gen.colors), splitValues(gen.sizes), splitValues(gen.options));
    setRows((rs) => {
      const keep = rs.filter((r) => r.id || r.sku || r.color || r.size || r.option3);
      const added = combos
        .filter((c) => !keep.some((r) => same(r, c)))
        .map((c) => {
          // Re-use the photo already chosen for this colour, if any.
          const photo = keep.find((r) => r.color && r.color.toLowerCase() === c.color.toLowerCase() && r.imagePath)?.imagePath ?? null;
          // SKU left empty: assigned on save (<product SKU>-01, -02, …).
          return { ...blankRow(), ...c, imagePath: photo };
        });
      return [...keep, ...added];
    });
  }

  function choosePhoto(row: VariantRow, path: string | null) {
    setRows((rs) => rs.map((r) => (r.key === row.key || (applyToColor && row.color && r.color.toLowerCase() === row.color.toLowerCase()) ? { ...r, imagePath: path } : r)));
    setPicking(null);
  }

  const thumb = (path: string | null) => photoOptions.find((i) => i.storage_path === path);

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1.6fr_1fr]" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}
      {!product && <input type="hidden" name="newId" value={newId} />}
      {!product && <input type="hidden" name="photos" value={JSON.stringify(newPhotos.map((p) => ({ path: p.path, alt: p.alt })))} />}
      <input type="hidden" name="variants" value={variantsJson} />

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <div className="field">
            <label htmlFor="name" className="label">Name</label>
            <input
              id="name"
              name="name"
              required
              maxLength={160}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              className="input"
            />
            <FieldError state={state} name="name" />
          </div>
          <div className="field">
            <label htmlFor="slug" className="label">Web address</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">/product/</span>
              <input id="slug" name="slug" required maxLength={120} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className="input" />
            </div>
            <FieldError state={state} name="slug" />
          </div>
          <div className="field">
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              name="description"
              rows={8}
              maxLength={10000}
              defaultValue={product?.description ?? ''}
              placeholder={'A short paragraph about the product.\n\n- UV400 polarised lenses\n- Comes with a case and cloth\n\nMaterial: Metal\nFrame width: 140 mm'}
              className="input"
            />
            <p className="hint">
              On the product page, lines starting with <b>-</b> become the <b>About this item</b> list, and <b>Label: value</b> lines (e.g. <i>Material: Metal</i>) become the <b>Product details</b> table. Other text shows as the description.
            </p>
            <FieldError state={state} name="description" />
          </div>
        </section>

        {!product && <NewProductPhotos productId={newId} photos={newPhotos} onChange={setNewPhotos} productName={name} />}

        <section className="card space-y-5 p-5">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              Variations &amp; stock
              <span className="rounded-md bg-soft px-2 py-0.5 font-mono text-[12px] font-semibold text-muted">
                Product SKU: <span className="text-ink">{product?.sku ?? 'assigned on save'}</span>
              </span>
            </h2>
            <p className="text-xs text-muted">
              Up to three variation types — for example Colour, Size and Sleeve. Every combination gets its own SKU, price, stock and photo.
              Leave a new row&apos;s SKU empty and it becomes {product?.sku ?? 'the product SKU'}-01, -02, … on save.
              Leave price empty to use the product price. Stock of saved variations changes in Inventory, so every change is logged.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="field">
              <label htmlFor="colorLabel" className="label">Type 1 name</label>
              <input id="colorLabel" name="colorLabel" value={labels.color} onChange={(e) => setLabels((l) => ({ ...l, color: e.target.value }))} maxLength={20} className="input" placeholder="Color" />
            </div>
            <div className="field">
              <label htmlFor="sizeLabel" className="label">Type 2 name</label>
              <input id="sizeLabel" name="sizeLabel" value={labels.size} onChange={(e) => setLabels((l) => ({ ...l, size: e.target.value }))} maxLength={20} className="input" placeholder="Size" />
            </div>
            <div className="field">
              <label htmlFor="option3Label" className="label">Type 3 name <span className="font-normal text-muted">(optional)</span></label>
              <input id="option3Label" name="option3Label" value={labels.option3} onChange={(e) => setLabels((l) => ({ ...l, option3: e.target.value }))} maxLength={20} className="input" placeholder="e.g. Sleeve, Fabric" />
              <FieldError state={state} name="option3Label" />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-paper p-4">
            <p className="text-sm font-semibold">Create combinations</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="field">
                <label htmlFor="gen-colors" className="label">{labels.color || 'Color'} values</label>
                <input id="gen-colors" value={gen.colors} onChange={(e) => setGen((g) => ({ ...g, colors: e.target.value }))} className="input" placeholder="Red, Navy, White" />
              </div>
              <div className="field">
                <label htmlFor="gen-sizes" className="label flex items-center justify-between">
                  <span>{labels.size || 'Size'} values</span>
                  <span className="flex gap-1 font-normal">
                    <button type="button" className="text-[11px] text-brand underline" onClick={() => setGen((g) => ({ ...g, sizes: 'S, M, L, XL' }))}>S–XL</button>
                    <button type="button" className="text-[11px] text-brand underline" onClick={() => setGen((g) => ({ ...g, sizes: 'Free size' }))}>Free size</button>
                  </span>
                </label>
                <input id="gen-sizes" value={gen.sizes} onChange={(e) => setGen((g) => ({ ...g, sizes: e.target.value }))} className="input" placeholder="S, M, L, XL" />
              </div>
              <div className="field">
                <label htmlFor="gen-options" className="label">{labels.option3 || 'Type 3'} values</label>
                <input id="gen-options" value={gen.options} onChange={(e) => setGen((g) => ({ ...g, options: e.target.value }))} className="input" placeholder="Full sleeve, Half sleeve" disabled={!labels.option3} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-outline btn-sm" onClick={createCombinations} disabled={!gen.colors.trim() && !gen.sizes.trim() && !gen.options.trim()}>
                Add {combinations(splitValues(gen.colors), splitValues(gen.sizes), splitValues(gen.options)).filter((c) => c.color || c.size || c.option3).length || ''} combinations
              </button>
              <span className="text-[12px] text-muted">Separate values with commas. Rows you already have are kept.</span>
            </div>
          </div>

          {fe.variants && <p className="error">{fe.variants}</p>}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th aria-label="Drag to change the order"></th><th>Photo</th><th>{labels.color || 'Color'}</th><th>{labels.size || 'Size'}</th>{showOption3 && <th>{labels.option3 || 'Type 3'}</th>}
                  <th title="Leave empty on a new row: it becomes the product SKU plus -01, -02, …">SKU</th><th>Price ৳</th><th title="What one piece costs you. Empty: the product's cost price">Cost ৳</th><th>Stock</th><th>Active</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rowDrag.list.map((r, i) => {
                  const t = thumb(r.imagePath);
                  return (
                    <tr key={r.key} {...rowDrag.handlers(i)} className={rowDrag.dragging === i ? 'bg-tint' : ''}>
                      <td className="w-8 px-1">
                        <span {...rowDrag.handleProps} className="grid h-12 w-7 select-none place-items-center rounded-md text-lg text-muted hover:bg-soft" title="Drag to move" aria-hidden="true">⠿</span>
                      </td>
                      <td className="relative">
                        <button
                          type="button"
                          onClick={() => setPicking(picking === r.key ? null : r.key)}
                          aria-label={`Photo for ${[r.color, r.size, r.option3].filter(Boolean).join(' / ') || 'this variation'}`}
                          className={`relative grid h-12 w-10 place-items-center overflow-hidden rounded-lg border ${t ? 'border-brand/40' : 'border-dashed border-line text-muted'} bg-tint`}
                        >
                          {t ? <ProductImage path={t.storage_path} alt="" sizes="40px" /> : <span className="text-lg">+</span>}
                        </button>
                        {picking === r.key && (
                          <div className="absolute left-0 top-full z-20 mt-1 w-72 space-y-2 rounded-xl border border-line bg-white p-3 shadow-xl" role="dialog" aria-label="Choose a photo">
                            {photoOptions.length === 0 ? (
                              <p className="text-[12.5px] text-muted">Add photos above first, then pick one here.</p>
                            ) : (
                              <div className="grid grid-cols-4 gap-1.5">
                                {photoOptions.map((img) => (
                                  <button key={img.id} type="button" onClick={() => choosePhoto(r, img.storage_path)} className={`relative aspect-[4/5] overflow-hidden rounded-md border-2 ${img.storage_path === r.imagePath ? 'border-brand' : 'border-transparent'} bg-tint`} aria-label={img.alt ?? 'Photo'}>
                                    <ProductImage path={img.storage_path} alt="" sizes="60px" />
                                  </button>
                                ))}
                              </div>
                            )}
                            {r.color && (
                              <label className="flex items-center gap-1.5 text-[12px] text-muted">
                                <input type="checkbox" checked={applyToColor} onChange={(e) => setApplyToColor(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                                Use for every “{r.color}” row
                              </label>
                            )}
                            <div className="flex justify-between">
                              {r.imagePath && <button type="button" className="text-[12px] text-bad underline" onClick={() => choosePhoto(r, null)}>No photo</button>}
                              <button type="button" className="ml-auto text-[12px] underline" onClick={() => setPicking(null)}>Close</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="min-w-32"><input aria-label={labels.color || 'Color'} value={r.color} onChange={(e) => update(r.key, { color: e.target.value })} className="input" maxLength={30} /></td>
                      <td className="min-w-20">
                        <input aria-label={labels.size || 'Size'} value={r.size} onChange={(e) => update(r.key, { size: e.target.value })} className="input" maxLength={20} />
                        {fe[`variants.${i}.size`] && <p className="error">{fe[`variants.${i}.size`]}</p>}
                      </td>
                      {showOption3 && <td className="min-w-36"><input aria-label={labels.option3 || 'Type 3'} value={r.option3} onChange={(e) => update(r.key, { option3: e.target.value })} className="input" maxLength={30} /></td>}
                      <td className="min-w-44">
                        <input aria-label="SKU" value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} placeholder={r.id ? undefined : 'Auto'} className="input font-mono text-sm" maxLength={64} />
                        {fe[`variants.${i}.sku`] && <p className="error">{fe[`variants.${i}.sku`]}</p>}
                      </td>
                      <td className="min-w-24">
                        <input aria-label="Price" inputMode="decimal" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} placeholder="—" className="input" />
                        {fe[`variants.${i}.price`] && <p className="error">{fe[`variants.${i}.price`]}</p>}
                      </td>
                      <td className="min-w-24">
                        <input aria-label="Cost" inputMode="decimal" value={r.cost} onChange={(e) => update(r.key, { cost: e.target.value })} placeholder="—" className="input" />
                        {fe[`variants.${i}.cost`] && <p className="error">{fe[`variants.${i}.cost`]}</p>}
                      </td>
                      <td className="min-w-20">
                        {r.id ? (
                          <Link href={`/admin/inventory?variant=${r.id}`} className="inline-block pt-2.5 font-semibold text-brand hover:underline">{r.stock ?? 0}</Link>
                        ) : (
                          <input aria-label="Opening stock" inputMode="numeric" value={r.openingStock} onChange={(e) => update(r.key, { openingStock: e.target.value.replace(/\D/g, '') })} className="input" title="Opening stock" />
                        )}
                      </td>
                      <td className="pt-4"><input type="checkbox" aria-label="Active" checked={r.isActive} onChange={(e) => update(r.key, { isActive: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" /></td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm text-bad" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove variation">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            Add one variation
          </button>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <div className="field">
            <label htmlFor="status" className="label">Status</label>
            <select id="status" name="status" defaultValue={product?.status ?? 'draft'} className="input">
              <option value="draft">Draft — hidden</option>
              <option value="published">Published — on the shop</option>
              <option value="archived">Archived — hidden, kept for orders</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="categoryId" className="label">Category</label>
            <select id="categoryId" name="categoryId" defaultValue={product?.category_id ?? ''} className="input">
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <DiscountFields
            basePrice={product ? Number(product.base_price) : null}
            compareAtPrice={product?.compare_at_price == null ? null : Number(product.compare_at_price)}
            style={product?.discount_style === 'amount' ? 'amount' : 'percent'}
            errors={{ basePrice: <FieldError state={state} name="basePrice" />, compareAtPrice: <FieldError state={state} name="compareAtPrice" /> }}
          />
          <div className="field">
            <label htmlFor="costPrice" className="label">Cost price ৳ <span className="font-normal text-muted">(what one piece costs you)</span></label>
            <input id="costPrice" name="costPrice" inputMode="decimal" defaultValue={costs?.product ?? ''} placeholder="e.g. 650" className="input" />
            <p className="hint">Used only for profit in Accounting — never shown in the shop. Variations can have their own cost in the table above.</p>
            <FieldError state={state} name="costPrice" />
          </div>
          <StockOutFields mode={product?.stock_out_mode ?? 'sold_out'} days={product?.preorder_days ?? null} error={<FieldError state={state} name="preorderDays" />} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isFeatured" defaultChecked={product?.is_featured ?? false} className="h-4 w-4 accent-[var(--brand)]" />
            Feature on the home page
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Search engines</h2>
          <div className="field">
            <label htmlFor="seoTitle" className="label">Title (optional)</label>
            <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={product?.seo_title ?? ''} className="input" />
            <FieldError state={state} name="seoTitle" />
          </div>
          <div className="field">
            <label htmlFor="seoDescription" className="label">Description (optional)</label>
            <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={3} defaultValue={product?.seo_description ?? ''} className="input" />
            <FieldError state={state} name="seoDescription" />
          </div>
        </section>

        <div className="space-y-3 xl:sticky xl:top-20">
          <FormMessage state={state} />
          <PendingButton pending={pending} className="btn btn-primary w-full">{product ? 'Save product' : 'Create product'}</PendingButton>
        </div>
      </div>
    </form>
  );
}
