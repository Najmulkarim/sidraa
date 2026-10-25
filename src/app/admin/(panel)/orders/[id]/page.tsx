import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourierPanel } from '@/components/admin/CourierPanel';
import { PaymentPanel } from '@/components/admin/PaymentPanel';
import type { CourierOptions, OrderRow } from '@/components/admin/OrdersTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatusForm } from '@/components/admin/StatusForm';
import { requirePermission } from '@/lib/auth';
import { formatDateTime, formatTaka } from '@/lib/format';
import { isEditable, STATUS_LABEL } from '@/lib/order-status';
import { formatBdPhone } from '@/lib/phone';
import type { Order, OrderHistory, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ supabase, can }, { id }, { saved }] = await Promise.all([requirePermission('orders'), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase
    .from('orders')
    .select('*, items:order_items(*), history:order_status_history(*)')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as Order & { items: OrderItem[]; history: OrderHistory[] };
  const history = [...order.history].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Names of admins who changed the status (owner can read all profiles; staff see their own).
  const changerIds = [...new Set(history.map((h) => h.changed_by).filter(Boolean))] as string[];
  const { data: people } = changerIds.length
    ? await supabase.from('admin_profiles').select('user_id, full_name').in('user_id', changerIds)
    : { data: [] };
  const { data: courierData } = can.has('courier') ? await supabase.rpc('courier_options') : { data: null };
  const open = !order.deleted_at && isEditable(order.status);
  const nameOf = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
        <h1 className="font-mono text-2xl font-bold text-brand">{order.public_ref}</h1>
        <StatusBadge status={order.status} />
        {order.deleted_at && <span className="badge">Deleted</span>}
        {order.source !== 'website' && <span className="badge">Source: {order.source}</span>}
        {order.coupon_code && <span className="badge badge-brand">Coupon {order.coupon_code}</span>}
        <span className="ml-auto flex gap-2">
          {can.has('orders_edit') && open && !order.courier_consignment_id && (
            <Link href={`/admin/orders/${order.id}/edit`} className="btn btn-primary btn-sm">Edit order</Link>
          )}
          <Link href={`/admin/orders/${order.id}/slip`} target="_blank" className="btn btn-outline btn-sm">Print packing slip</Link>
        </span>
      </header>
      {saved && <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Order saved. Totals and stock were recalculated.</p>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Price</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:underline">{i.product_name}</Link> : i.product_name}
                        {i.variant_label && <div className="text-xs text-muted">{i.variant_label}</div>}
                      </td>
                      <td className="font-mono text-xs">{i.sku}</td>
                      <td className="text-right">{formatTaka(i.unit_price)}</td>
                      <td className="text-right">{i.quantity}</td>
                      <td className="text-right font-semibold">{formatTaka(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatTaka(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery ({order.zone_name})</dt><dd>{formatTaka(order.delivery_charge)}</dd></div>
              {Number(order.discount) > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>−{formatTaka(order.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatTaka(order.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd>{formatTaka(order.paid_amount)}</dd></div>
              <div className="flex justify-between font-semibold text-brand"><dt>Collect on delivery</dt><dd>{formatTaka(Math.max(0, Number(order.total) - Number(order.paid_amount)))}</dd></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">History</h2>
            <ol className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <div>
                    <p>
                      <span className="font-medium">{h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : ''}{STATUS_LABEL[h.to_status]}</span>
                      <span className="text-muted"> · {formatDateTime(h.created_at)}{h.changed_by ? ` · ${nameOf.get(h.changed_by) ?? 'Admin'}` : ''}</span>
                    </p>
                    {h.note && <p className="text-muted">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Customer</h2>
            {order.redacted_at && <p className="badge">Personal details removed {formatDateTime(order.redacted_at)}</p>}
            <p className="text-lg font-medium">{order.customer_name}</p>
            <p>
              <a href={`tel:${order.customer_phone}`} className="font-semibold text-brand">{formatBdPhone(order.customer_phone)}</a>
            </p>
            <p className="whitespace-pre-line text-sm">{order.address}</p>
            <p className="text-sm text-muted">{[order.area, order.district].filter(Boolean).join(', ')}</p>
            {order.note && <p className="rounded-xl bg-accent/10 p-3 text-sm"><span className="font-semibold">Note: </span>{order.note}</p>}
            <p className="text-xs text-muted">Placed {formatDateTime(order.created_at)}</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Payment</h2>
            <PaymentPanel order={order} canEdit={can.has('orders_edit')} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Courier</h2>
            <CourierPanel
              order={order as unknown as OrderRow & { courier_sent_at: string | null; courier_synced_at: string | null; courier_charge: number | string | null }}
              couriers={(courierData ?? null) as CourierOptions | null}
              canSend={can.has('courier')}
              open={open}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Status</h2>
            <StatusForm orderId={order.id} status={order.status} />
          </section>
        </div>
      </div>
    </div>
  );
}
