'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { saveIncomplete } from '@/actions/admin-incomplete';
import { formatTaka } from '@/lib/format';
import type { DeliveryZone, VariantOption } from '@/lib/types';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { IncompleteActions } from './IncompleteActions';
import { OrderItemsDialog } from './OrderItemsDialog';
import { notify } from './Toaster';

export type IncompleteRow = {
  id: string; status: 'open' | 'converted' | 'cancelled'; phone: string; phoneText: string; name: string | null;
  address: string | null; area: string | null; district: string | null; note: string | null; zoneId: string | null; zoneText: string | null;
  items: { variant_id: string; quantity: number }[]; ago: string; when: string;
};

/**
 * Incomplete orders as short rows (many fit on a screen): who, where, what, when,
 * then Make order / Edit / Cancel / Delete. Edit opens a popup for the address,
 * delivery area, note and products.
 */
export function IncompleteList({ rows, options, zones, canConvert }: { rows: IncompleteRow[]; options: VariantOption[]; zones: DeliveryZone[]; canConvert: boolean }) {
  const byId = useMemo(() => new Map(options.map((o) => [o.variant_id, o])), [options]);
  const [editing, setEditing] = useState<IncompleteRow | null>(null);

  return (
    <>
      <ul className="card divide-y divide-line overflow-hidden">
        {rows.map((r) => {
          const lines = r.items.map((l) => ({ ...l, o: byId.get(l.variant_id) }));
          const total = lines.reduce((n, l) => n + (l.o ? l.o.price * l.quantity : 0), 0);
          const place = [r.address, r.area, r.district].filter(Boolean).join(', ');
          const first = lines[0]?.o;
          return (
            <li key={r.id} className="grid gap-x-4 gap-y-2 px-4 py-3 text-[13.5px] lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,15rem)_auto] lg:items-center">
              <div className="flex min-w-0 items-baseline justify-between gap-2 lg:block">
                <p className="truncate font-semibold">{r.name || <span className="font-normal text-muted">No name yet</span>}</p>
                <span className="flex shrink-0 items-center gap-2 lg:mt-0.5">
                  <a href={`tel:${r.phone}`} className="font-mono text-[13px] font-semibold text-brand hover:underline">{r.phoneText}</a>
                  <span className="text-[11.5px] text-muted lg:hidden" title={r.when}>{r.ago}</span>
                </span>
              </div>

              <div className="min-w-0 text-[12.5px]">
                <p className={`line-clamp-2 ${place ? '' : 'text-muted'}`} title={place}>{place || 'No address yet'}</p>
                {(r.zoneText || r.note) && <p className="truncate text-muted">{[r.zoneText, r.note && `Note: ${r.note}`].filter(Boolean).join(' · ')}</p>}
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <OrderItemsDialog
                  orderRef={r.name || r.phoneText}
                  items={lines.map((l, i) => ({ id: `${l.variant_id}-${i}`, product_name: l.o?.product_name ?? 'Item no longer available', sku: l.o?.sku ?? '—', variant_label: l.o?.label ?? '', unit_price: l.o?.price ?? 0, quantity: l.quantity, image: l.o?.image ?? null }))}
                >
                  <span className="flex shrink-0 -space-x-2">
                    {lines.slice(0, 3).map((l, i) => (
                      <span key={i} className="relative block h-9 w-9 overflow-hidden rounded-lg border-2 border-white bg-tint ring-1 ring-line transition group-hover/items:ring-brand"><ProductImage path={l.o?.image ?? null} alt="" sizes="36px" /></span>
                    ))}
                  </span>
                </OrderItemsDialog>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px]" title={lines.map((l) => `${l.o?.product_name ?? 'Unavailable item'} × ${l.quantity}`).join('\n')}>
                    {first ? first.product_name : lines.length ? 'Item no longer available' : <span className="text-muted">No products</span>}
                    {lines.length > 1 && <span className="text-muted"> +{lines.length - 1} more</span>}
                  </span>
                  <b className="font-semibold">{formatTaka(total)}</b>
                  <span className="ml-2 hidden text-[11.5px] text-muted lg:inline" title={r.when}>{r.ago}</span>
                </span>
              </div>

              <IncompleteActions id={r.id} status={r.status} canConvert={canConvert} name={r.name || r.phoneText} onEdit={r.status !== 'converted' ? () => setEditing(r) : undefined} />
            </li>
          );
        })}
      </ul>
      {editing && <EditDialog key={editing.id} row={editing} options={options} byId={byId} zones={zones} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditDialog({ row, options, byId, zones, onClose }: { row: IncompleteRow; options: VariantOption[]; byId: Map<string, VariantOption>; zones: DeliveryZone[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    customerName: row.name ?? '', customerPhone: row.phone, address: row.address ?? '', area: row.area ?? '', district: row.district ?? '', note: row.note ?? '', zoneId: row.zoneId ?? '',
  });
  const [items, setItems] = useState(row.items);
  const [q, setQ] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return options.filter((o) => `${o.product_name} ${o.label} ${o.sku}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, options]);
  const qty = (id: string, d: number) => setItems((cur) => cur.map((l) => (l.variant_id === id ? { ...l, quantity: Math.min(20, Math.max(1, l.quantity + d)) } : l)));
  const add = (id: string) => {
    setItems((cur) => (cur.some((l) => l.variant_id === id) ? cur.map((l) => (l.variant_id === id ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l)) : [...cur, { variant_id: id, quantity: 1 }]));
    setQ('');
  };
  const total = items.reduce((n, l) => n + (byId.get(l.variant_id)?.price ?? 0) * l.quantity, 0);
  const zone = zones.find((z) => z.id === f.zoneId);

  const save = () => start(async () => {
    const r = await saveIncomplete(row.id, { ...f, items });
    notify(r.ok, r.message);
    if (r.ok) { onClose(); router.refresh(); }
  });

  const input = 'input h-10 text-[14px]';
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-3 backdrop-blur-sm sm:p-4" onClick={() => !pending && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Edit incomplete order" className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-lg font-bold">Edit incomplete order</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-soft text-muted hover:bg-line"><Icon name="x" size={16} /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field"><span className="label">Name</span><input value={f.customerName} onChange={set('customerName')} maxLength={120} className={input} /></label>
            <label className="field"><span className="label">Mobile number</span><input value={f.customerPhone} onChange={set('customerPhone')} inputMode="tel" maxLength={20} className={`${input} font-mono`} /></label>
            <label className="field sm:col-span-2"><span className="label">Address</span><textarea value={f.address} onChange={set('address')} maxLength={500} rows={2} className="input text-[14px]" /></label>
            <label className="field"><span className="label">Area / thana</span><input value={f.area} onChange={set('area')} maxLength={80} className={input} /></label>
            <label className="field"><span className="label">District</span><input value={f.district} onChange={set('district')} maxLength={80} className={input} /></label>
            <label className="field"><span className="label">Delivery area</span>
              <select value={f.zoneId} onChange={set('zoneId')} className={input}>
                <option value="">Not chosen</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {formatTaka(z.charge)}</option>)}
              </select>
            </label>
            <label className="field"><span className="label">Note</span><input value={f.note} onChange={set('note')} maxLength={500} className={input} /></label>
          </div>

          <div className="space-y-2">
            <p className="label">Products</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {items.length === 0 && <li className="p-3 text-sm text-muted">No products — add one below.</li>}
              {items.map((l) => {
                const o = byId.get(l.variant_id);
                return (
                  <li key={l.variant_id} className="flex items-center gap-3 p-2.5 text-[13.5px]">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={o?.image ?? null} alt="" sizes="44px" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o?.product_name ?? 'Item no longer available'}</span>
                      <span className="block text-[12px] text-muted">{[o?.label, o && formatTaka(o.price)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="flex shrink-0 items-center rounded-full border border-line">
                      <button type="button" onClick={() => qty(l.variant_id, -1)} disabled={l.quantity <= 1} aria-label="One less" className="grid h-8 w-8 place-items-center disabled:opacity-30">−</button>
                      <span className="w-6 text-center font-semibold">{l.quantity}</span>
                      <button type="button" onClick={() => qty(l.variant_id, 1)} disabled={l.quantity >= 20} aria-label="One more" className="grid h-8 w-8 place-items-center disabled:opacity-30">+</button>
                    </span>
                    <button type="button" onClick={() => setItems((cur) => cur.filter((x) => x.variant_id !== l.variant_id))} aria-label="Remove" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-bad hover:bg-bad/10"><Icon name="trash" size={15} /></button>
                  </li>
                );
              })}
            </ul>
            <div className="relative">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a product — type its name or SKU" className={input} />
              {found.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
                  {found.map((o) => (
                    <li key={o.variant_id}>
                      <button type="button" onClick={() => add(o.variant_id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-soft">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={o.image} alt="" sizes="36px" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate">{o.product_name}</span><span className="text-[11.5px] text-muted">{[o.label, o.sku].filter(Boolean).join(' · ')}</span></span>
                        <span className="shrink-0 font-semibold">{formatTaka(o.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
          <p className="text-[13px] text-muted">Items <b className="text-ink">{formatTaka(total)}</b>{zone && <> · delivery {formatTaka(zone.charge)}</>}</p>
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-outline btn-sm ml-auto">Cancel</button>
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
