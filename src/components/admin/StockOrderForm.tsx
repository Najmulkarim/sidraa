'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { cancelStockOrder, deleteStockOrder, receiveStockOrder, saveStockOrder } from '@/actions/admin-stock-orders';
import { formatTaka } from '@/lib/format';
import { stockOrderTotals, type InventoryRow } from '@/lib/inventory';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';
import { PHOTO_ACCEPT, uploadHomeImage } from '@/lib/upload-photo';

export type StockOrderView = {
  id: string;
  ref: string;
  status: 'draft' | 'received' | 'cancelled';
  supplier: string | null;
  supplier_phone: string | null;
  note: string | null;
  expected_on: string | null;
  created_at: string;
  received_at: string | null;
  items: { variant_id: string | null; quantity: number; unit_cost: number | null; new_name: string | null; new_color: string | null; new_size: string | null; new_image: string | null; new_price: number | null; product_id: string | null }[];
};

/** variantId null: a product that is not listed yet (made as a Draft product when received). */
type Line = { key: string; variantId: string | null; quantity: string; unitCost: string; newName: string; newColor: string; newSize: string; newImage: string | null; newPrice: string; productId: string | null };
let seq = 0;
const newKey = () => `l${++seq}`;

/**
 * A stock-in order: supplier, expected date, note and the items (search by
 * name or SKU, with photos) with quantity and unit cost. Saved as a draft;
 * "Receive stock" adds it all to stock at once.
 */
export function StockOrderForm({ order, variants, withCost, canSaveCost }: { order?: StockOrderView; variants: InventoryRow[]; withCost: boolean; canSaveCost: boolean }) {
  const router = useRouter();
  const draft = !order || order.status === 'draft';
  const [supplier, setSupplier] = useState(order?.supplier ?? '');
  const [phone, setPhone] = useState(order?.supplier_phone ?? '');
  const [note, setNote] = useState(order?.note ?? '');
  const [expected, setExpected] = useState(order?.expected_on ?? '');
  const [lines, setLines] = useState<Line[]>(order?.items.map((i) => ({
    key: newKey(), variantId: i.variant_id, quantity: String(i.quantity), unitCost: i.unit_cost === null ? '' : String(i.unit_cost),
    newName: i.new_name ?? '', newColor: i.new_color ?? '', newSize: i.new_size ?? '', newImage: i.new_image, newPrice: i.new_price === null ? '' : String(i.new_price), productId: i.product_id,
  })) ?? []);
  const [q, setQ] = useState('');
  const [saving, startSave] = useTransition();
  const [acting, startAct] = useTransition();
  const [asking, setAsking] = useState<null | 'receive' | 'cancel' | 'delete'>(null);
  const [saveCosts, setSaveCosts] = useState(true);
  const [dirty, setDirty] = useState(false);

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return variants.filter((v) => !lines.some((l) => l.variantId === v.id) && `${v.name} ${v.sku} ${v.variant}`.toLowerCase().includes(t)).slice(0, 12);
  }, [q, variants, lines]);
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const sum = stockOrderTotals(lines.map((l) => ({ quantity: Number(l.quantity) || 0, unit_cost: num(l.unitCost) })));
  const edit = (i: number, patch: Partial<Line>) => { setLines((cur) => cur.map((l, n) => (n === i ? { ...l, ...patch } : l))); setDirty(true); };
  const blank = { newName: '', newColor: '', newSize: '', newImage: null, newPrice: '', productId: null };
  const add = (v: InventoryRow) => { setLines((cur) => [...cur, { key: newKey(), variantId: v.id, quantity: '1', unitCost: v.cost === null ? '' : String(v.cost), ...blank }]); setQ(''); setDirty(true); };
  // Another colour / size of the new product above keeps its name and price.
  const addNew = (like?: Line) => { setLines((cur) => [...cur, { key: newKey(), variantId: null, quantity: '1', unitCost: like?.unitCost ?? '', ...blank, newName: like?.newName ?? '', newPrice: like?.newPrice ?? '', newImage: like?.newImage ?? null }]); setDirty(true); };

  const save = () => startSave(async () => {
    const bad = lines.find((l) => !(Number(l.quantity) >= 1) || !Number.isInteger(Number(l.quantity)));
    if (bad) return notify(false, 'Each line needs a whole quantity of at least 1.');
    if (lines.some((l) => !l.variantId && !l.newName.trim())) return notify(false, 'Write the name of each new product.');
    const r = await saveStockOrder({
      id: order?.id, supplier, supplierPhone: phone, note, expectedOn: expected,
      items: lines.map((l) => ({
        variantId: l.variantId, quantity: Number(l.quantity), unitCost: num(l.unitCost),
        ...(l.variantId ? {} : { newName: l.newName, newColor: l.newColor, newSize: l.newSize, newImage: l.newImage, newPrice: num(l.newPrice) }),
      })),
    });
    if (r) { notify(r.ok, r.message); if (r.ok) { setDirty(false); router.refresh(); } }
  });
  const act = (kind: 'receive' | 'cancel' | 'delete') => startAct(async () => {
    const r = kind === 'receive' ? await receiveStockOrder(order!.id, saveCosts && canSaveCost) : kind === 'cancel' ? await cancelStockOrder(order!.id) : await deleteStockOrder(order!.id);
    notify(r.ok, r.message);
    setAsking(null);
    if (r.ok && kind === 'delete') router.push('/admin/inventory/stock-orders');
    else router.refresh();
  });

  const input = 'input h-10 text-[14px]';
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <section className="card grid gap-3 p-5 sm:grid-cols-2">
          <label className="field"><span className="label">Supplier</span><input value={supplier} disabled={!draft} onChange={(e) => { setSupplier(e.target.value); setDirty(true); }} maxLength={120} placeholder="e.g. China Source" className={input} /></label>
          <label className="field"><span className="label">Supplier phone</span><input value={phone} disabled={!draft} onChange={(e) => { setPhone(e.target.value); setDirty(true); }} maxLength={30} placeholder="Optional" className={input} /></label>
          <label className="field"><span className="label">Expected on</span><input type="date" value={expected} disabled={!draft} onChange={(e) => { setExpected(e.target.value); setDirty(true); }} className={input} /></label>
          <label className="field"><span className="label">Note</span><input value={note} disabled={!draft} onChange={(e) => { setNote(e.target.value); setDirty(true); }} maxLength={1000} placeholder="e.g. Invoice CS23403" className={input} /></label>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Items</h2>
          {draft && (
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a product by name, SKU or colour / size to add it" className={`${input} pl-9`} />
              {found.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
                  {found.map((v) => (
                    <li key={v.id}>
                      <button type="button" onClick={() => add(v)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-soft">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={v.image} alt="" sizes="40px" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{v.name}</span>
                          <span className="font-mono text-[11.5px] text-muted">{v.sku}{v.variant ? ` · ${v.variant}` : ''} · stock {v.stock}</span>
                        </span>
                        <Icon name="plus" size={16} className="text-brand" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {draft && (
            <button type="button" onClick={() => addNew()} className="flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
              <Icon name="plus" size={14} /> Add a new product (not listed yet)
            </button>
          )}
          {lines.length === 0 ? <p className="rounded-lg bg-soft p-4 text-center text-[13px] text-muted">No items yet. Search above to add listed products, or add a new one.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-2">Product</th>
                    <th className="px-2 py-2 text-right">In stock</th>
                    <th className="px-2 py-2 text-right">Quantity</th>
                    <th className="px-2 py-2 text-right">Unit cost</th>
                    <th className="px-2 py-2 text-right">Line total</th>
                    {draft && <th />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const v = l.variantId ? byId.get(l.variantId) : undefined;
                    const cost = num(l.unitCost);
                    return (
                      <tr key={l.key} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2">
                          {!l.variantId || (l.productId && !v) ? (
                            <NewProductCell line={l} draft={draft} onChange={(patch) => edit(i, patch)} onAnother={() => addNew(l)} />
                          ) : (
                          <span className="flex items-center gap-2.5">
                            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={v?.image} alt="" sizes="40px" /></span>
                            <span className="min-w-0">
                              <span className="block max-w-[240px] truncate font-medium">{v?.name ?? 'Removed item'}</span>
                              <span className="font-mono text-[11px] text-muted">{v?.sku}{v?.variant ? ` · ${v.variant}` : ''}</span>
                              {l.productId && <a href={`/admin/products/${l.productId}`} className="block text-[11.5px] font-semibold text-brand hover:underline">New draft product: add price & photos, then publish →</a>}
                            </span>
                          </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-muted">{l.variantId ? v?.stock ?? '—' : <span className="rounded bg-tint px-1.5 text-[10.5px] font-bold text-brand">NEW</span>}</td>
                        <td className="px-2 py-2 text-right">
                          {draft ? <input type="number" min={1} step={1} value={l.quantity} onChange={(e) => edit(i, { quantity: e.target.value })} aria-label="Quantity" className="input h-9 w-20 text-right font-mono" /> : <span className="font-mono font-semibold">{l.quantity}</span>}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {draft ? <input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => edit(i, { unitCost: e.target.value })} placeholder="—" aria-label="Unit cost" className="input h-9 w-24 text-right font-mono" /> : <span className="font-mono">{cost === null ? '—' : formatTaka(cost)}</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{cost === null ? '—' : formatTaka(cost * (Number(l.quantity) || 0))}</td>
                        {draft && (
                          <td className="py-2 pl-1 text-right">
                            <button type="button" aria-label="Remove" onClick={() => { setLines((cur) => cur.filter((_, n) => n !== i)); setDirty(true); }} className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:text-bad"><Icon name="x" size={14} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {draft && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving || lines.length === 0} className="btn btn-primary">{saving ? 'Saving…' : order ? 'Save changes' : 'Save as draft'}</button>
            <Link href="/admin/inventory/stock-orders" className="btn btn-outline">Back</Link>
          </div>
        )}
      </div>

      <aside className="card h-fit space-y-4 p-5 xl:sticky xl:top-20">
        <h2 className="font-semibold">Summary</h2>
        <dl className="space-y-1.5 text-[14px]">
          <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="font-mono">{sum.lines}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Units</dt><dd className="font-mono">{sum.units}</dd></div>
          {withCost && <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Total cost</dt><dd className="font-mono">{formatTaka(sum.cost)}</dd></div>}
        </dl>
        {order && order.status === 'draft' && (
          <div className="space-y-2 border-t border-line pt-4">
            {dirty && <p className="rounded-lg bg-warn/10 p-2 text-[12.5px] text-warn">Save your changes before receiving.</p>}
            <button type="button" disabled={dirty || acting || lines.length === 0} onClick={() => setAsking('receive')} className="btn w-full border-0 bg-ok text-white hover:brightness-105"><Icon name="check" size={16} /> Receive stock</button>
            <button type="button" disabled={acting} onClick={() => setAsking('cancel')} className="btn btn-outline btn-sm w-full">Cancel order</button>
          </div>
        )}
        {order && order.status !== 'received' && (
          <button type="button" disabled={acting} onClick={() => setAsking('delete')} className="flex items-center gap-1.5 text-[13px] font-semibold text-bad hover:underline"><Icon name="trash" size={14} /> Delete</button>
        )}
        {order?.status === 'received' && <p className="rounded-lg bg-ok/10 p-3 text-[13px] text-ok">Received — these units were added to stock. Each line is in Inventory → Stock in.</p>}
        {order?.status === 'cancelled' && <p className="rounded-lg bg-soft p-3 text-[13px] text-muted">Cancelled — stock was not changed.</p>}
      </aside>

      <ConfirmDialog
        open={asking !== null}
        title={asking === 'receive' ? `Receive ${sum.units} units into stock?` : asking === 'cancel' ? 'Cancel this stock-in order?' : 'Delete this stock-in order?'}
        confirmLabel={asking === 'receive' ? 'Yes, add to stock' : asking === 'cancel' ? 'Yes, cancel' : 'Yes, delete'}
        pendingLabel="Working…"
        pending={acting}
        onClose={() => setAsking(null)}
        onConfirm={() => asking && act(asking)}
      >
        {asking === 'receive' ? (
          <span className="block space-y-2">
            <span className="block">Every line is added to stock now and logged as Restock. This cannot be undone here (use Adjust if a count was wrong).</span>
            {canSaveCost && (
              <label className="flex items-center gap-2 font-medium text-ink">
                <input type="checkbox" checked={saveCosts} onChange={(e) => setSaveCosts(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                Also save these unit costs as the cost prices
              </label>
            )}
          </span>
        ) : asking === 'cancel' ? 'Stock does not change. You can delete it after.' : 'It is removed from the list. Stock does not change.'}
      </ConfirmDialog>
    </div>
  );
}

/** A product not listed yet: name, colour, size, photo and selling price, written on the line. */
function NewProductCell({ line, draft, onChange, onAnother }: { line: Line; draft: boolean; onChange: (patch: Partial<Line>) => void; onAnother: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const r = await uploadHomeImage(file);
    setBusy(false);
    if ('error' in r) notify(false, r.error);
    else onChange({ newImage: r.path });
  }
  const box = 'input h-8 px-2 text-[12.5px]';
  return (
    <div className="flex items-start gap-2.5">
      <button type="button" disabled={!draft} onClick={() => input.current?.click()} title={draft ? 'Add a photo' : undefined} className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-brand/40 bg-tint text-brand">
        {line.newImage ? <ProductImage path={line.newImage} alt="" sizes="56px" /> : <span className="text-center text-[10px] font-semibold leading-tight">{busy ? '…' : '+ Photo'}</span>}
      </button>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {draft ? (
        <div className="grid min-w-0 flex-1 gap-1.5">
          <input value={line.newName} onChange={(e) => onChange({ newName: e.target.value })} maxLength={160} placeholder="New product name" className={`${box} font-semibold`} />
          <div className="grid grid-cols-3 gap-1.5">
            <input value={line.newColor} onChange={(e) => onChange({ newColor: e.target.value })} maxLength={30} placeholder="Colour" className={box} />
            <input value={line.newSize} onChange={(e) => onChange({ newSize: e.target.value })} maxLength={20} placeholder="Size" className={box} />
            <input type="number" min={0} step="0.01" value={line.newPrice} onChange={(e) => onChange({ newPrice: e.target.value })} placeholder="Sell price" title="Selling price (can be set later)" className={`${box} font-mono`} />
          </div>
          <button type="button" onClick={onAnother} className="w-fit text-[11.5px] font-semibold text-brand hover:underline">+ Another colour / size of this product</button>
        </div>
      ) : (
        <span className="min-w-0">
          <span className="block max-w-[240px] truncate font-medium">{line.newName}</span>
          <span className="block text-[11px] text-muted">{[line.newColor, line.newSize].filter(Boolean).join(' / ') || 'New product'}</span>
          {line.productId && <a href={`/admin/products/${line.productId}`} className="block text-[11.5px] font-semibold text-brand hover:underline">Draft product made: add details, then publish →</a>}
        </span>
      )}
    </div>
  );
}
