'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { bulkSendToCourier, refreshCourierStatus } from '@/actions/admin-courier';
import { addNote, assignOrder, bulkStatus, deleteOrder, getOrderLogs, quickStatus, restoreOrder, type OrderLog } from '@/actions/admin-orders';
import { COURIER_LABEL, courierStatusLabel, type CourierName } from '@/lib/courier/types';
import { formatDateTime, formatTaka, toNumber } from '@/lib/format';
import { isPickupCancelled, nextStatusesFor, STATUS_LABEL, type OrderStatus } from '@/lib/order-status';
import type { ActionState, Staff } from '@/lib/types';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { OrderEditDialog } from './OrderEditDialog';
import { DuplicateOrderButton } from './DuplicateOrderButton';
import { SendCourierDialog } from './SendCourierDialog';
import { notify } from './Toaster';

export type OrderRow = {
  id: string;
  public_ref: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  address: string;
  area: string | null;
  district: string;
  note: string | null;
  total: number | string;
  paid_amount: number | string;
  payment_method?: string;
  payment_status?: string;
  assigned_to: string | null;
  deleted_at: string | null;
  created_at: string;
  last_note: string | null;
  source: string;
  courier: CourierName | null;
  courier_consignment_id: string | null;
  courier_tracking_code: string | null;
  courier_status: string | null;
  courier_error: string | null;
  items: { id: string; product_name: string; variant_label: string; quantity: number; image: string | null }[];
};

export type Stat = { delivered: number; failed: number; orders: number };
export type CourierOptions = { default_courier: CourierName | null; steadfast: boolean; pathao: boolean };
export type TablePerms = { courier: boolean; del: boolean; edit: boolean };

const SOURCE_SHORT: Record<string, string> = { phone: 'Phone', facebook: 'Facebook', whatsapp: 'WhatsApp', instagram: 'Instagram', other: 'Manual' };

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-[#eef2ff] text-[#4338ca]',
  confirmed: 'bg-tint text-brand',
  processing: 'bg-[#ecfeff] text-[#0e7490]',
  hold: 'bg-[#fef3c7] text-[#92400e]',
  ship_later: 'bg-[#f5f3ff] text-[#6d28d9]',
  shipped: 'bg-[#e0f2fe] text-[#0369a1]',
  delivered: 'bg-[#dcfce7] text-[#15803d]',
  cancelled: 'bg-[#fee2e2] text-[#b91c1c]',
  returned: 'bg-[#ffedd5] text-[#c2410c]',
  lost: 'bg-[#f3f4f6] text-[#374151]',
  fake: 'bg-[#1f1d2b] text-white',
};

function successRate(s: Stat | undefined): { text: string; tone: string; title: string } {
  const finished = (s?.delivered ?? 0) + (s?.failed ?? 0);
  if (!s || finished === 0) return { text: 'New', tone: 'text-muted', title: 'No finished orders from this number yet' };
  const pct = Math.round((s.delivered / finished) * 100);
  return {
    text: `${pct}%`,
    tone: pct >= 80 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-bad',
    title: `${s.delivered} delivered, ${s.failed} returned/cancelled/fake out of ${s.orders} orders from this number`,
  };
}

const waLink = (phone: string) => `https://wa.me/88${phone}`;

export function OrdersTable({
  orders,
  stats,
  staff,
  deletedTab,
  perms,
  couriers,
  blocked = [],
}: {
  orders: OrderRow[];
  stats: Record<string, Stat>;
  staff: Staff[];
  deletedTab: boolean;
  perms: TablePerms;
  couriers: CourierOptions | null;
  blocked?: string[];
}) {
  const blockedSet = new Set(blocked);
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Only Ready to deliver orders can go to a courier.
  const sendable = orders.filter((o) => selected.has(o.id) && o.status === 'processing' && !o.courier_consignment_id).map((o) => o.id);
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [sending, setSending] = useState<OrderRow | null>(null);
  const readyCouriers = (['steadfast', 'pathao'] as CourierName[]).filter((c) => couriers?.[c]);
  const [bulkCourier, setBulkCourier] = useState<CourierName>(couriers?.default_courier && couriers[couriers.default_courier] ? couriers.default_courier : readyCouriers[0] ?? 'steadfast');
  const [notesFor, setNotesFor] = useState<OrderRow | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // "fake:<id>" / "delete:<id>" waiting for a second click
  const [bulkTo, setBulkTo] = useState<OrderStatus>('confirmed');

  // Selection is per page; drop it when the list changes.
  const ids = orders.map((o) => o.id).join();
  useEffect(() => setSelected(new Set()), [ids]);

  const flash = (r: ActionState) => {
    notify(r.ok, r.message ?? (r.ok ? 'Saved.' : 'Something went wrong.'));
  };
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      flash(r);
      // Done: start the next job with a fresh selection.
      setSelected(new Set());
      router.refresh();
    });
  const arm = (key: string, then: () => void) => {
    if (armed === key) {
      setArmed(null);
      then();
    } else {
      setArmed(key);
      setTimeout(() => setArmed((a) => (a === key ? null : a)), 3000);
    }
  };

  const allOnPage = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const staffName = new Map(staff.map((s) => [s.user_id, s.full_name]));
  const closeEdit = useCallback(() => setEditing(null), []);
  const closeSend = useCallback(() => setSending(null), []);

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-tint px-4 py-2.5 text-[13px]" role="region" aria-label="Bulk actions">
          <strong className="text-brand">{selected.size} selected</strong>
          {!deletedTab && (
            <>
              <label htmlFor="bulk-status" className="text-muted">Move to</label>
              <select id="bulk-status" className="input min-h-9 w-auto py-1" value={bulkTo} onChange={(e) => setBulkTo(e.target.value as OrderStatus)}>
                {(['confirmed', 'processing', 'shipped', 'delivered', 'hold', 'ship_later', 'cancelled', 'returned', 'lost', 'fake'] as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => bulkStatus([...selected], bulkTo))}>Apply</button>
            </>
          )}
          {!deletedTab && perms.courier && readyCouriers.length > 0 && sendable.length > 0 && (
            <span className="flex items-center gap-1.5 border-l border-brand/20 pl-3">
              <label htmlFor="bulk-courier" className="text-muted">Send to</label>
              <select id="bulk-courier" className="input min-h-9 w-auto py-1" value={bulkCourier} onChange={(e) => setBulkCourier(e.target.value as CourierName)}>
                {readyCouriers.map((c) => <option key={c} value={c}>{COURIER_LABEL[c]}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy || sendable.length > 50} title={sendable.length > 50 ? 'At most 50 at a time' : undefined} onClick={() => run(() => bulkSendToCourier(sendable, bulkCourier))}>
                <Icon name="send" size={14} /> Send {sendable.length}
              </button>
            </span>
          )}
          <Link href={`/admin/orders/slips?ids=${[...selected].join(',')}`} target="_blank" className="btn btn-outline btn-sm"><Icon name="printer" size={15} /> Print slips</Link>
          <button type="button" className="ml-auto text-muted underline" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[1220px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-soft text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(orders.map((o) => o.id)))} className="h-4 w-4 accent-[var(--brand)]" />
              </th>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Courier</th>
              <th className="px-3 py-3">Notes</th>
              <th className="px-3 py-3">Employee</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={10} className="py-16 text-center text-muted">No orders match these filters.</td></tr>
            )}
            {orders.map((o) => {
              const rate = successRate(stats[o.customer_phone]);
              const total = toNumber(o.total);
              const paid = toNumber(o.paid_amount);
              const due = Math.max(0, total - paid);
              const next = nextStatusesFor(o.status, o.courier_status);
              const can = (s: OrderStatus) => !o.deleted_at && next.includes(s);
              return (
                <tr key={o.id} className={`border-b border-line align-top last:border-0 hover:bg-soft/60 ${selected.has(o.id) ? 'bg-tint/60' : ''}`}>
                  <td className="px-3 py-4">
                    <input type="checkbox" aria-label={`Select ${o.public_ref}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[var(--brand)]" />
                  </td>
                  <td className="px-3 py-4">
                    <Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap font-mono text-[12.5px] font-bold text-ink hover:text-brand">{o.public_ref}</Link>
                    <p className="mt-1 whitespace-nowrap font-mono text-[11px] text-muted">{formatDateTime(o.created_at)}</p>
                    {o.source !== 'website' && <span className="mt-1 inline-block rounded bg-[#eef2ff] px-1.5 text-[10.5px] font-semibold text-[#4338ca]">{SOURCE_SHORT[o.source] ?? o.source}</span>}
                  </td>
                  <td className="max-w-[270px] px-3 py-4">
                    <p className="flex items-center gap-1.5 font-semibold"><Icon name="user" size={13} className="text-muted" /><span>{o.customer_name}</span>
                      <Link href={`/admin/customers/${o.customer_phone}`} className="shrink-0 whitespace-nowrap rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-brand hover:bg-brand hover:text-white" title="See all orders from this customer">{stats[o.customer_phone]?.orders ?? 1} order{(stats[o.customer_phone]?.orders ?? 1) === 1 ? '' : 's'}</Link></p>
                    <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                      <Icon name="phone" size={13} className="text-muted" />
                      <a href={`tel:${o.customer_phone}`} className="font-mono hover:text-brand">{o.customer_phone}</a>
                      <span className={`font-semibold ${rate.tone}`} title={rate.title}>{rate.text}</span>
                      {blockedSet.has(o.customer_phone) && <span className="rounded bg-bad px-1 text-[10px] font-bold text-white" title="This number is on the block list">Blocked</span>}
                      <a href={waLink(o.customer_phone)} target="_blank" rel="noopener noreferrer" className="grid h-5 w-5 place-items-center rounded-full bg-[#25d366] text-white" aria-label={`WhatsApp ${o.customer_name}`}>
                        <Icon name="whatsapp" size={12} strokeWidth={2} />
                      </a>
                    </p>
                    <p className="mt-1 flex gap-1.5 text-[11.5px] leading-snug text-muted">
                      <Icon name="pin" size={13} className="mt-0.5 shrink-0" />
                      <span>{o.address}{o.area ? `, ${o.area}` : ''}, {o.district}</span>
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex max-w-[150px] flex-wrap gap-1.5">
                      {o.items.slice(0, 4).map((i) => (
                        <span key={i.id} className="relative block h-11 w-11 overflow-hidden rounded-lg border border-line bg-tint" title={`${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`}>
                          <ProductImage path={i.image} alt={i.product_name} sizes="44px" />
                          {i.quantity > 1 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-night px-1 text-[9px] font-bold text-white">×{i.quantity}</span>}
                        </span>
                      ))}
                      {o.items.length > 4 && <span className="grid h-11 w-11 place-items-center rounded-lg border border-line text-[11px] text-muted">+{o.items.length - 4}</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 font-mono">
                    <p className="text-[13.5px] font-bold">{formatTaka(total)}</p>
                    <p className="text-[11px] text-muted">Paid {formatTaka(paid)}</p>
                    {o.payment_method && o.payment_method !== 'cod' && (
                      <p className={`mt-0.5 w-fit rounded px-1.5 text-[10.5px] font-bold text-white ${o.payment_status === 'paid' ? 'bg-ok' : o.payment_status === 'failed' ? 'bg-bad' : o.payment_method === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#f6921e]'}`}>
                        {o.payment_method === 'bkash' ? 'bKash' : 'Nagad'} · {o.payment_status === 'paid' ? 'paid' : o.payment_status === 'failed' ? 'not paid' : 'check'}
                      </p>
                    )}
                    {['cancelled', 'fake', 'returned', 'lost'].includes(o.status) ? (
                      <p className="text-[11px] font-semibold text-muted">Not collected</p>
                    ) : (
                      <p className={`text-[11px] font-semibold ${due > 0 ? 'text-brand' : 'text-ok'}`}>Due {formatTaka(due)}</p>
                    )}
                    <p className="text-[10.5px] text-muted">COD</p>
                  </td>
                  <td className="px-3 py-4">
                    {o.deleted_at ? (
                      <span className="inline-flex rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-semibold text-muted">Deleted · {STATUS_LABEL[o.status]}</span>
                    ) : next.length === 0 ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[o.status]}`}>● {o.status === 'cancelled' && isPickupCancelled(o.courier_status) ? 'Pickup cancelled' : STATUS_LABEL[o.status]}</span>
                    ) : (
                      <select
                        aria-label={`Status of ${o.public_ref}`}
                        value={o.status}
                        disabled={busy}
                        onChange={(e) => run(() => quickStatus(o.id, e.target.value))}
                        className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-6 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-brand/40 ${STATUS_STYLE[o.status]}`}
                      >
                        <option value={o.status}>● {o.status === 'cancelled' && isPickupCancelled(o.courier_status) ? 'Pickup cancelled' : STATUS_LABEL[o.status]}</option>
                        {next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="max-w-[150px] px-3 py-4">
                    {o.courier && o.courier_consignment_id ? (
                      <div className="space-y-0.5">
                        <p className="font-semibold">{COURIER_LABEL[o.courier]}</p>
                        <p className="font-mono text-[11px] text-muted" title="Consignment ID">#{o.courier_consignment_id}</p>
                        {o.courier_tracking_code && <p className="font-mono text-[11px] text-muted" title="Tracking code">{o.courier_tracking_code}</p>}
                        {o.courier_status && <p className="text-[11px] font-semibold text-[#0369a1]">{courierStatusLabel(o.courier_status)}</p>}
                        {perms.courier && o.status === 'shipped' && (
                          <button type="button" className="flex items-center gap-1 text-[11px] text-brand hover:underline" disabled={busy} onClick={() => run(() => refreshCourierStatus(o.id))}>
                            <Icon name="refresh" size={12} /> Check now
                          </button>
                        )}
                      </div>
                    ) : perms.courier && !o.deleted_at && o.status === 'processing' ? (
                      <div className="space-y-1">
                        <button type="button" className="btn btn-outline btn-sm min-h-8 whitespace-nowrap px-2.5 text-[11.5px]" onClick={() => setSending(o)}>
                          <Icon name="send" size={13} /> Send
                        </button>
                        {o.courier_error && <p className="line-clamp-3 text-[10.5px] text-bad" title={o.courier_error}>{o.courier_error}</p>}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-3 py-4">
                    {o.last_note && <p className="mb-1 line-clamp-2 text-[11.5px] text-ink" title={o.last_note}>{o.last_note}</p>}
                    <div className="flex gap-3 whitespace-nowrap text-[11.5px]">
                      <button type="button" className="flex items-center gap-1 text-brand hover:underline" onClick={() => setNotesFor(o)}><Icon name="note" size={13} /> Add note</button>
                      <button type="button" className="flex items-center gap-1 text-muted hover:text-ink hover:underline" onClick={() => setNotesFor(o)}><Icon name="clock" size={13} /> Logs</button>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <label className="sr-only" htmlFor={`emp-${o.id}`}>Employee for {o.public_ref}</label>
                    <select
                      id={`emp-${o.id}`}
                      value={o.assigned_to ?? ''}
                      disabled={busy || !!o.deleted_at}
                      onChange={(e) => run(() => assignOrder(o.id, e.target.value || null))}
                      className={`max-w-[130px] cursor-pointer rounded-full border border-line py-1 pl-2.5 pr-6 text-[11.5px] font-medium outline-none focus:border-brand ${o.assigned_to ? 'bg-white text-ink' : 'bg-soft text-muted'}`}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
                      {o.assigned_to && !staffName.has(o.assigned_to) && <option value={o.assigned_to}>Former staff</option>}
                    </select>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-1">
                      {o.deleted_at ? (
                        <button type="button" title="Restore" aria-label={`Restore ${o.public_ref}`} disabled={!perms.del} className="grid disabled:opacity-30 h-8 w-8 place-items-center rounded-lg border border-line text-ok hover:bg-[#dcfce7]" onClick={() => run(() => restoreOrder(o.id))}>
                          <Icon name="restore" size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={!can('fake') || busy}
                            title={armed === `fake:${o.id}` ? 'Click again to mark as fake' : 'Mark as fake'}
                            aria-label={`Mark ${o.public_ref} as fake`}
                            onClick={() => arm(`fake:${o.id}`, () => run(() => quickStatus(o.id, 'fake')))}
                            className={`grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-30 ${armed === `fake:${o.id}` ? 'border-bad bg-bad text-white' : 'border-line text-bad hover:bg-[#fee2e2]'}`}
                          >
                            <Icon name="ban" size={16} />
                          </button>
                          {perms.edit && <DuplicateOrderButton id={o.id} publicRef={o.public_ref} icon />}
                          <button type="button" title="Edit" aria-label={`Edit ${o.public_ref}`} disabled={busy} onClick={() => setEditing(o)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[#4338ca] hover:bg-[#eef2ff]">
                            <Icon name="pencil" size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={!can('hold') || busy}
                            title="Put on hold"
                            aria-label={`Put ${o.public_ref} on hold`}
                            onClick={() => run(() => quickStatus(o.id, 'hold'))}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-warn hover:bg-[#fef3c7] disabled:opacity-30"
                          >
                            <Icon name="pause" size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={!perms.del || busy}
                            title={armed === `delete:${o.id}` ? 'Click again to delete' : 'Delete'}
                            aria-label={`Delete ${o.public_ref}`}
                            onClick={() => arm(`delete:${o.id}`, () => run(() => deleteOrder(o.id)))}
                            className={`grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-30 ${armed === `delete:${o.id}` ? 'border-bad bg-bad text-white' : 'border-line text-bad hover:bg-[#fee2e2]'}`}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    {armed?.endsWith(o.id) && <p className="mt-1 text-right text-[10.5px] text-bad">Click again to confirm</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {editing && <OrderEditDialog order={editing} onClose={closeEdit} onSaved={(r) => { flash(r); setEditing(null); router.refresh(); }} />}
      {sending && couriers && <SendCourierDialog order={sending} couriers={couriers} onClose={closeSend} onDone={(r) => { flash(r); setSending(null); router.refresh(); }} />}
      {notesFor && <NotesPanel order={notesFor} onClose={() => setNotesFor(null)} onSaved={(r) => { flash(r); router.refresh(); }} />}
    </>
  );
}

function NotesPanel({ order, onClose, onSaved }: { order: OrderRow; onClose: () => void; onSaved: (r: ActionState) => void }) {
  const [logs, setLogs] = useState<OrderLog[] | null>(null);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = () => getOrderLogs(order.id).then((r) => setLogs(r.logs));
  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-night/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="notes-title" className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="notes-title" className="font-bold">Notes &amp; logs</h2>
            <p className="font-mono text-[12px] text-muted">{order.public_ref} · {order.customer_name}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        <form
          className="space-y-2 border-b border-line p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await addNote(order.id, text);
              if (!r.ok) return setError(r.message ?? 'Could not save the note.');
              setText('');
              onSaved(r);
              await load();
            });
          }}
        >
          <label htmlFor="note-text" className="label">Add a note</label>
          <textarea id="note-text" className="input min-h-20" maxLength={1000} placeholder="e.g. Customer asked to deliver after 5 pm" value={text} onChange={(e) => setText(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-sm" disabled={pending || !text.trim()}>{pending ? 'Saving…' : 'Save note'}</button>
        </form>
        <ol className="flex-1 space-y-4 overflow-y-auto p-5">
          {logs === null && <li className="text-[13px] text-muted">Loading…</li>}
          {logs?.length === 0 && <li className="text-[13px] text-muted">Nothing yet.</li>}
          {logs?.map((l, i) => (
            <li key={i} className="flex gap-3 text-[13px]">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.kind === 'note' ? 'bg-brand' : l.kind === 'status' ? 'bg-[#0369a1]' : 'bg-muted'}`} aria-hidden="true" />
              <div>
                <p className={l.kind === 'note' ? 'text-ink' : 'text-ink/80'}>{l.text}</p>
                <p className="text-[11px] text-muted">{formatDateTime(l.at)}{l.by ? ` · ${l.by}` : ''}{l.kind === 'note' ? ' · note' : ''}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
