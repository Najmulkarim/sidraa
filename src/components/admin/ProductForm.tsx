'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { addProductImage, saveProduct } from '@/actions/admin-catalog';
import { PHOTO_ACCEPT, uploadProductPhoto } from '@/lib/upload-photo';
import { slugify } from '@/lib/slug';
import type { Category, Product, ProductImage as ProductImageRow, Variant } from '@/lib/types';
import { combinations, splitValues } from '@/lib/variations';
import { ProductImage } from '../shop/ProductImage';
import { CategoryFields } from './CategoryFields';
import { TagField } from './TagField';
import { DescriptionEditor } from './DescriptionEditor';
import { DiscountFields } from './DiscountFields';
import { RemoveVariationButton } from './RemoveVariationButton';
import { StockOutFields } from './StockOutFields';
import { useDragSort } from './useDragSort';
import { NewProductPhotos, type PendingPhoto } from './NewProductPhotos';
import { notify } from './Toaster';
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
export function ProductForm({ product, variants, categories, images = [], costs, allTags = [] }: { product?: Product; variants?: Variant[]; categories: Category[]; images?: ProductImageRow[]; costs?: { product: number | null; variants: Record<string, number> }; allTags?: string[] }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveProduct);
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [labels, setLabels] = useState({ color: product?.color_label ?? 'Color', size: product?.size_label ?? 'Size', option3: product?.option3_label ?? '' });
  const [rows, setRows] = useState<VariantRow[]>(variants && variants.length > 0 ? variants.map((v) => toRow(v, costs?.variants[v.id])) : [blankRow()]);
  const [gen, setGen] = useState({ colors: '', sizes: '', options: '' });
  const [picking, setPicking] = useState<string | null>(null);
  // The photo popup closes with Esc too.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  // New products get their id now, so photos can be uploaded before the first save.
  const [newId] = useState(() => (product ? '' : crypto.randomUUID()));
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  // Photos uploaded from a variation's photo box, shown at once (the page refreshes behind).
  const [uploaded, setUploaded] = useState<ProductImageRow[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const router = useRouter();
  const photoOptions: ProductImageRow[] = product
    ? [...images, ...uploaded.filter((u) => !images.some((i) => i.storage_path === u.storage_path))]
    : newPhotos.map((ph, i) => ({ id: ph.path, storage_path: ph.path, alt: ph.alt || null, sort_order: i }));
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

  /** A new photo from the computer for one variation: added to the product's photos and chosen for it. */
  async function uploadForRow(row: VariantRow, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFor(row.key);
    const id = product?.id ?? newId;
    const up = await uploadProductPhoto(id, file);
    if ('error' in up) { setUploadingFor(null); notify(false, up.error); return; }
    if (product) {
      const res = await addProductImage({ productId: id, storagePath: up.path, alt: name || product.name });
      if (!res.ok) { setUploadingFor(null); notify(false, res.message ?? 'The photo could not be added.'); return; }
      setUploaded((u) => [...u, { id: up.path, storage_path: up.path, alt: name || null, sort_order: images.length + u.length }]);
      router.refresh();
    } else {
      setNewPhotos((p) => [...p, { path: up.path, alt: '' }]);
    }
    setUploadingFor(null);
    choosePhoto(row, up.path);
    notify(true, 'Photo added to the product and chosen for this variation.');
  }

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
            <DescriptionEditor
              productId={product?.id ?? newId}
              defaultValue={product?.description ?? ''}
              placeholder="Write about the product. Select text, then use the buttons above."
            />
            <p className="hint">
              Select text, then press a button: <b>B</b> bold, <b>H1</b>/<b>H2</b> headings, a list style (✓ • ➤ 1.), or <b>Picture</b> to add photos (from your computer, a link, or Ctrl+V). Lists show under <b>About this item</b>; a small heading right above a list becomes its title. Lines like <i>Material: PU</i> go to the <b>Product details</b> table. Press <b>Preview</b> to see the product page.
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
                  <th title="Leave empty on a new row: it becomes the product SKU plus -01, -02, …">SKU</th><th>Price ৳</th><th title="What one piece costs you. Empty: the product's cost price">Cost ৳</th><th>Stock</th><th title="Hidden variations are not shown on the website or in the Facebook catalogue">Show</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rowDrag.list.map((r, i) => {
                  const t = thumb(r.imagePath);
                  return (
                    <tr key={r.key} {...rowDrag.handlers(i)} className={`transition-colors ${rowDrag.dragging === i ? 'bg-tint' : !r.isActive ? 'bg-bad/10 [&_input]:opacity-60 [&_img]:grayscale [&_img]:opacity-60' : ''}`}>
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
                        {picking === r.key && createPortal(
                          <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" onClick={() => setPicking(null)}>
                          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Choose a photo" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-start gap-3">
                              <div className="min-w-0">
                                <h2 className="text-lg font-bold">Variation photo</h2>
                                <p className="truncate text-[13px] text-muted">{[r.color, r.size, r.option3].filter(Boolean).join(' / ') || 'This variation'} · choose a photo, or upload a new one</p>
                              </div>
                              <button type="button" onClick={() => setPicking(null)} aria-label="Close" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-soft">×</button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                              <label className={`grid aspect-[4/5] cursor-pointer place-items-center rounded-md border-2 border-dashed border-brand/50 bg-tint/60 text-center text-brand transition hover:border-brand hover:bg-tint ${uploadingFor === r.key ? 'pointer-events-none opacity-60' : ''}`} title="Upload a new photo from your computer">
                                <span className="grid justify-items-center gap-0.5 text-[10.5px] font-semibold leading-tight">
                                  <span className="text-lg leading-none">{uploadingFor === r.key ? '…' : '+'}</span>
                                  {uploadingFor === r.key ? 'Uploading' : 'Upload new'}
                                </span>
                                <input type="file" accept={PHOTO_ACCEPT} className="sr-only" disabled={uploadingFor === r.key} onChange={(e) => void uploadForRow(r, e)} aria-label="Upload a new photo for this variation" />
                              </label>
                              {photoOptions.map((img) => (
                                <button key={img.id} type="button" onClick={() => choosePhoto(r, img.storage_path)} className={`relative aspect-[4/5] overflow-hidden rounded-md border-2 ${img.storage_path === r.imagePath ? 'border-brand' : 'border-transparent'} bg-tint`} aria-label={img.alt ?? 'Photo'}>
                                  <ProductImage path={img.storage_path} alt="" sizes="60px" />
                                </button>
                              ))}
                            </div>
                            {r.color && (
                              <label className="flex items-center gap-2 text-[13px] text-muted">
                                <input type="checkbox" checked={applyToColor} onChange={(e) => setApplyToColor(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                                Use for every “{r.color}” row
                              </label>
                            )}
                            <div className="flex items-center justify-between">
                              {r.imagePath && <button type="button" className="text-[13px] text-bad underline" onClick={() => choosePhoto(r, null)}>No photo</button>}
                              <button type="button" className="btn btn-outline btn-sm ml-auto" onClick={() => setPicking(null)}>Close</button>
                            </div>
                          </div>
                          </div>,
                          document.body,
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
                      <td className="pt-1.5">
                        <button
                          type="button"
                          aria-pressed={r.isActive}
                          aria-label={r.isActive ? 'Shown on the website: press to hide' : 'Hidden from the website: press to show'}
                          title={r.isActive ? 'Shown — press to hide from the website and Facebook catalogue' : 'Hidden — press to show again'}
                          onClick={() => update(r.key, { isActive: !r.isActive })}
                          className={`grid h-9 w-9 place-items-center rounded-full transition ${r.isActive ? 'text-ink hover:bg-soft' : 'text-bad hover:bg-bad/10'}`}
                        >
                          {r.isActive ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>
                          )}
                        </button>
                      </td>
                      <td>
                        <RemoveVariationButton
                          name={[r.color, r.size, r.option3].filter(Boolean).join(' / ') || r.sku || 'this variation'}
                          saved={!!r.id}
                          disabled={rows.length === 1}
                          onConfirm={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        />
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
          <CategoryFields categories={categories} main={product?.category_id ?? ''} extra={product?.extra_category_ids ?? []} />
          <TagField initial={product?.tags ?? []} suggestions={allTags} />
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
