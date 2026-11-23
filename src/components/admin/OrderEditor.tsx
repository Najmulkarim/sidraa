'use client';

import { startTransition, useActionState, useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { saveOrderFull } from '@/actions/admin-orders';
import { formatDate, formatTaka, toNumber } from '@/lib/format';
import { addLine, availableFor, editorTotals, sellsWhenOut, type EditorLine } from '@/lib/order-editor';
import { normalizeBdPhone } from '@/lib/phone';
import { lastCustomerDetails, type LastCustomer } from '@/actions/admin-orders';
import type { ActionState, DeliveryZone, EditableOrder, VariantOption } from '@/lib/types';
import { ORDER_SOURCES } from '@/lib/validation';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { FieldError, FormMessage } from './ui';
import { DISTRICT_LIST_ID, DistrictList } from '@/components/admin/DistrictList';

const SOURCE_LABEL: Record<(typeof ORDER_SOURCES)[number], string> = {
  website: 'Website',
  phone: 'Phone call',
  facebook: 'Facebook page / Messenger',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  other: 'Other',
};

/** A new order started from something the customer already entered (an incomplete checkout). */
export type OrderPrefill = {
  customerName: string; customerPhone: string; address: string; district: string; area: string; note: string;
  zoneId: string | null; source: string; lines: EditorLine[];
};

type Props = {
  order?: EditableOrder;
  prefill?: OrderPrefill;
  options: VariantOption[];
  zones: DeliveryZone[];
  onSaved?: (r: ActionState) => void;
  onCancel?: () => void;
};

/**
 * Edit everything on an open order — or take a new order by phone /
 * Facebook. Prices are editable on purpose (agreed prices, exchanges); the
 * server recalculates totals and checks stock on save.
 */
export function OrderEditor({ order, prefill, options, zones, onSaved, onCancel }: Props) {
  const isNew = !order;
  const [state, dispatch, pending] = useActionState(saveOrderFull, { ok: false } as ActionState);
  const [idemKey] = useState(() => (isNew ? crypto.randomUUID() : ''));

  const [customer, setCustomer] = useState({
    customerName: order?.customer_name ?? prefill?.customerName ?? '',
    customerPhone: order?.customer_phone ?? prefill?.customerPhone ?? '',
    address: order?.address ?? prefill?.address ?? '',
    district: order?.district ?? prefill?.district ?? '',
    area: order?.area ?? prefill?.area ?? '',
    note: order?.note ?? prefill?.note ?? '',
  });
  const [zoneId, setZoneId] = useState(order?.zone_id ?? prefill?.zoneId ?? zones.find((z) => z.is_active)?.id ?? '');
  const [source, setSource] = useState<string>(order?.source ?? prefill?.source ?? 'phone');
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed');
  const [discount, setDiscount] = useState(order ? String(order.discount || '') : '');
  const [overrideDelivery, setOverrideDelivery] = useState(false);
  const [delivery, setDelivery] = useState(order ? String(order.delivery_charge) : '');
  const [paid, setPaid] = useState(order ? String(order.paid_amount) : '');
  const [lines, setLines] = useState<EditorLine[]>(
    () => order?.items.filter((i) => i.variant_id).map((i) => ({ variantId: i.variant_id!, quantity: i.quantity, unitPrice: i.unit_price })) ?? prefill?.lines ?? [],
  );
  const [query, setQuery] = useState('');
  // A mobile number that has ordered before shows that order's name and address; one button fills them (new orders only).
  const [known, setKnown] = useState<LastCustomer | null>(null);
  const [filled, setFilled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!isNew) return;
    const p = normalizeBdPhone(customer.customerPhone);
    if (!p) { setKnown(null); setFilled(false); setDismissed(false); return; }
    let live = true;
    const t = setTimeout(async () => {
      const last = await lastCustomerDetails(p).catch(() => null);
      if (!live) return;
      setKnown(last);
      setFilled(false);
      setDismissed(false);
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // Only a new number should look the customer up again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.customerPhone, isNew]);
  const knownZone = known?.zoneId ? zones.find((z) => z.id === known.zoneId && z.is_active) : undefined;
  const useAllKnown = () => {
    if (!known) return;
    setCustomer((s) => ({ ...s, customerName: known.customerName, address: known.address, district: known.district, area: known.area }));
    if (knownZone) setZoneId(knownZone.id);
    setFilled(true);
  };

  // If the order's delivery charge differs from the area's, it was set by hand — keep it.
  const byId = useMemo(() => new Map(options.map((o) => [o.variant_id, o])), [options]);
  const zone = zones.find((z) => z.id === zoneId);
  useEffect(() => {
    if (!order) return;
    const auto = editorTotals(lines, toNumber(order.discount), zones.find((z) => z.id === order.zone_id), null).delivery;
    if (auto !== order.delivery_charge) setOverrideDelivery(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.ok) onSaved?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const totals = editorTotals(lines, Number(discount || 0), zone, overrideDelivery && delivery !== '' ? Number(delivery) : null);
  const original = order?.items ?? [];
  const missing = order?.items.filter((i) => !i.variant_id) ?? [];

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => `${o.product_name} ${o.label} ${o.sku}`.toLowerCase().includes(q)).slice(0, 12)
    : [];

  const phoneOk = customer.customerPhone === '' || normalizeBdPhone(customer.customerPhone) !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    if (order) fd.set('orderId', order.id);
    else fd.set('idempotencyKey', idemKey);
    for (const [k, v] of Object.entries(customer)) fd.set(k, v);
    fd.set('zoneId', zoneId);
    fd.set('source', source);
    if (isNew) fd.set('status', status);
    fd.set('discount', discount);
    fd.set('deliveryCharge', overrideDelivery ? delivery : '');
    fd.set('paid', paid);
    fd.set('items', JSON.stringify(lines));
    startTransition(() => dispatch(fd));
  };

  const setLine = (i: number, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const c = (name: keyof typeof customer, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`oe-${name}`} className="label">{label}</label>
      <input id={`oe-${name}`} className="input" value={customer[name]} onChange={(e) => setCustomer((s) => ({ ...s, [name]: e.target.value }))} {...props} />
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {/* ----------------------------------------------------------- items */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">Products</h3>
        {missing.length > 0 && (
          <p className="rounded-lg bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
            {missing.map((m) => m.product_name).join(', ')} no longer exist{missing.length === 1 ? 's' : ''} in the catalogue and will be removed if you save.
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="bg-soft text-left text-[11px] uppercase tracking-wide text-muted">
              <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Size</th><th className="w-20 px-3 py-2">Qty</th><th className="w-28 px-3 py-2">Price ৳</th><th className="px-3 py-2 text-right">Total</th><th className="w-10" /></tr>
            </thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No products yet — search below to add.</td></tr>}
              {lines.map((l, i) => {
                const opt = byId.get(l.variantId);
                const sizes = opt ? options.filter((o) => o.product_name === opt.product_name) : [];
                const avail = opt ? availableFor(l.variantId, opt.stock, original) : 0;
                return (
                  <tr key={`${l.variantId}-${i}`} className="border-t border-line align-middle">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md border border-line bg-tint"><ProductImage path={opt?.image ?? null} alt="" sizes="36px" /></span>
                        <span className="font-medium">{opt?.product_name ?? 'Unknown product'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label="Size"
                        className="input min-h-9 py-1"
                        value={l.variantId}
                        onChange={(e) => {
                          const next = byId.get(e.target.value);
                          setLine(i, { variantId: e.target.value, unitPrice: opt && l.unitPrice !== opt.price ? l.unitPrice : next?.price ?? l.unitPrice });
                        }}
                      >
                        {sizes.map((s) => (
                          <option key={s.variant_id} value={s.variant_id} disabled={s.variant_id !== l.variantId && lines.some((x) => x.variantId === s.variant_id)}>
                            {s.label || s.sku} · {availableFor(s.variant_id, s.stock, original) > 0 ? `${availableFor(s.variant_id, s.stock, original)} left` : sellsWhenOut(s) ? (s.stock_out_mode === 'preorder' ? 'pre-order' : 'sale ongoing') : '0 left'}
                          </option>
                        ))}
                      </select>
                      {l.quantity > avail && (sellsWhenOut(opt)
                        ? <p className="mt-0.5 text-[10.5px] text-warn">{opt?.stock_out_mode === 'preorder' ? 'Pre-order' : 'Sale ongoing'} — stock goes below zero</p>
                        : <p className="error">Only {avail} available</p>)}
                    </td>
                    <td className="px-3 py-2">
                      <input aria-label="Quantity" inputMode="numeric" className="input min-h-9 py-1" value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(0, Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
                    </td>
                    <td className="px-3 py-2">
                      <input aria-label="Unit price" inputMode="decimal" className={`input min-h-9 py-1 ${opt && l.unitPrice !== opt.price ? 'border-warn' : ''}`} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                      {opt && l.unitPrice !== opt.price && <p className="mt-0.5 text-[10.5px] text-warn">Shop price {formatTaka(opt.price)}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{formatTaka(l.unitPrice * l.quantity)}</td>
                    <td className="px-1 py-2">
                      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-bad hover:bg-[#fee2e2]" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FieldError state={state} name="items" />
        <div className="relative">
          <label htmlFor="oe-search" className="sr-only">Add a product</label>
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="oe-search" className="input pl-9" placeholder="Add a product — type a name or SKU" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-xl" role="listbox" aria-label="Matching products">
              {matches.map((m) => {
                const avail = availableFor(m.variant_id, m.stock, original);
                return (
                  <li key={m.variant_id}>
                    <button
                      type="button"
                      disabled={avail <= 0 && !sellsWhenOut(m)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-soft disabled:opacity-40"
                      onClick={() => {
                        setLines((ls) => addLine(ls, m.variant_id, m.price));
                        setQuery('');
                      }}
                    >
                      <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-md border border-line bg-tint"><ProductImage path={m.image} alt="" sizes="32px" /></span>
                      <span className="flex-1"><strong>{m.product_name}</strong>{m.label ? ` · ${m.label}` : ''} <span className="font-mono text-[11px] text-muted">{m.sku}</span></span>
                      <span className="font-mono">{formatTaka(m.price)}</span>
                      <span className={`text-[11px] ${avail > 0 ? 'text-muted' : sellsWhenOut(m) ? 'text-warn' : 'text-bad'}`}>{avail > 0 ? `${avail} left` : sellsWhenOut(m) ? (m.stock_out_mode === 'preorder' ? 'Pre-order' : 'Sale ongoing') : 'Sold out'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------- customer */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">Customer</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {c('customerName', 'Name', { maxLength: 80, autoComplete: 'off' })}
          <div className="field">
            <label htmlFor="oe-customerPhone" className="label">Mobile number</label>
            <input id="oe-customerPhone" className="input" inputMode="tel" maxLength={20} value={customer.customerPhone} onChange={(e) => setCustomer((s) => ({ ...s, customerPhone: e.target.value }))} />
            {!phoneOk && <p className="error">Enter a valid mobile number, e.g. 01712345678</p>}
            <FieldError state={state} name="customerPhone" />
          </div>
        </div>
        {isNew && known && !dismissed && (
          filled ? (
            <p className="flex flex-wrap items-center gap-2 rounded-xl bg-ok/10 px-3.5 py-2.5 text-[13px] text-ok">
              <Icon name="check" size={15} />
              <span><b>Filled from {known.publicRef}.</b> Check the address and change anything that is different. · তথ্য বসানো হয়েছে, দরকার হলে বদলান।</span>
            </p>
          ) : (
            <div className="rounded-xl border-2 border-brand/30 bg-tint/60 p-3.5">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Icon name="user" size={16} className="text-brand" />
                This number has ordered before · এই নম্বরে আগে অর্ডার আছে ({known.publicRef}, {formatDate(known.createdAt)})
              </p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-white px-3 py-2 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="text-muted">Name</dt><dd className="font-medium">{known.customerName || '—'}</dd>
                <dt className="text-muted">Address</dt><dd className="font-medium">{known.address || '—'}</dd>
                <dt className="text-muted">District / area</dt><dd className="font-medium">{[known.district, known.area].filter(Boolean).join(', ') || '—'}</dd>
                {knownZone && <><dt className="text-muted">Delivery area</dt><dd className="font-medium">{knownZone.name}</dd></>}
              </dl>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={useAllKnown} className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
                  <Icon name="check" size={14} /> Fill these details · এই তথ্য বসান
                </button>
                <button type="button" onClick={() => setDismissed(true)} className="text-[12.5px] font-semibold text-muted underline hover:text-ink">No, new address</button>
              </div>
            </div>
          )
        )}
        {c('address', 'Address (house, road, area)', { maxLength: 300 })}
        <div className="grid gap-3 sm:grid-cols-2">
          {c('district', 'District', { maxLength: 60, list: DISTRICT_LIST_ID, autoComplete: 'off', placeholder: 'Type 2–3 letters, e.g. Din' })}
          <DistrictList />
          {c('area', 'Area / thana', { maxLength: 60 })}
        </div>
        {c('note', 'Note for this order', { maxLength: 500 })}
      </section>

      {/* -------------------------------------------------------- delivery */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="oe-zone" className="label">Delivery area</label>
          <select id="oe-zone" className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name} — {formatTaka(z.charge)}{z.is_active ? '' : ' (hidden in shop)'}</option>
            ))}
          </select>
          <FieldError state={state} name="zoneId" />
        </div>
        <div className="field">
          <label htmlFor="oe-source" className="label">Order came from</label>
          <select id="oe-source" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            {ORDER_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="oe-delivery" className="label">
            Delivery charge ৳ <span className="font-normal text-muted">{overrideDelivery ? '(set by hand)' : `(from ${zone?.name ?? 'the area'})`}</span>
          </label>
          {/* The area's charge by default; "Change" lets staff type their own, "Auto" goes back to the area's. */}
          <div className="relative">
            <input id="oe-delivery" inputMode="decimal" className={`input pr-24 ${overrideDelivery ? 'border-brand/50' : 'bg-soft text-muted'}`} readOnly={!overrideDelivery}
              value={overrideDelivery ? delivery : String(totals.delivery)} onChange={(e) => setDelivery(e.target.value)} />
            <button type="button"
              onClick={() => {
                if (overrideDelivery) { setOverrideDelivery(false); return; }
                setOverrideDelivery(true);
                if (delivery === '') setDelivery(String(totals.delivery));
                setTimeout(() => document.getElementById('oe-delivery')?.focus(), 0);
              }}
              className={`absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${overrideDelivery ? 'bg-soft text-muted hover:text-ink' : 'bg-white text-brand shadow-sm ring-1 ring-line hover:ring-brand/40'}`}
              title={overrideDelivery ? 'Use the delivery area\'s charge again' : 'Type a different delivery charge'}>
              <Icon name={overrideDelivery ? 'refresh' : 'pencil'} size={12} /> {overrideDelivery ? 'Auto' : 'Change'}
            </button>
          </div>
          <FieldError state={state} name="deliveryCharge" />
        </div>
        <div className="field">
          <label htmlFor="oe-discount" className="label">Discount ৳</label>
          <input id="oe-discount" inputMode="decimal" className="input" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <FieldError state={state} name="discount" />
        </div>
        <div className="field">
          <label htmlFor="oe-paid" className="label">Advance paid ৳ <span className="font-normal text-muted">(bKash / Nagad)</span></label>
          <input id="oe-paid" inputMode="decimal" className="input" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <FieldError state={state} name="paid" />
        </div>
        {isNew && (
          <div className="field">
            <label htmlFor="oe-status" className="label">Status</label>
            <select id="oe-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'confirmed')}>
              <option value="confirmed">Confirmed (already spoke to the customer)</option>
              <option value="pending">New (call to confirm)</option>
            </select>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- totals */}
      <dl className="space-y-1 rounded-xl bg-soft p-4 text-[13.5px]">
        <div className="flex justify-between"><dt className="text-muted">Products</dt><dd className="font-mono">{formatTaka(totals.subtotal)}</dd></div>
        {totals.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="font-mono">− {formatTaka(totals.discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="font-mono">{totals.delivery === 0 ? 'Free' : formatTaka(totals.delivery)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd className="font-mono">{formatTaka(totals.total)}</dd></div>
        {Number(paid || 0) > 0 && <div className="flex justify-between text-brand"><dt>Rider collects</dt><dd className="font-mono">{formatTaka(Math.max(0, totals.total - Number(paid)))}</dd></div>}
      </dl>

      {!state.ok && <FormMessage state={state} />}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={pending || lines.length === 0} aria-busy={pending}>
          {pending ? 'Saving…' : isNew ? 'Create order' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
