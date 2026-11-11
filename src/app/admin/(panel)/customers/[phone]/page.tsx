import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DuplicateOrderButton } from '@/components/admin/DuplicateOrderButton';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { OrderItemsDialog } from '@/components/admin/OrderItemsDialog';
import type { OrderItemInfo } from '@/components/admin/OrdersTable';
import { ProductImage } from '@/components/shop/ProductImage';
import { requirePermission } from '@/lib/auth';
import { formatDateTime, formatTaka, toNumber } from '@/lib/format';
import { isPickupCancelled, type OrderStatus } from '@/lib/order-status';
import { formatBdPhone } from '@/lib/phone';

export const metadata: Metadata = { title: 'Customer' };

const LIMIT = 200;

type Row = {
  id: string; public_ref: string; status: OrderStatus; total: number | string; created_at: string;
  customer_name: string; address: string; area: string | null; district: string; courier_status: string | null;
  items: {
    id: string; product_name: string; sku: string | null; variant_label: string | null; unit_price: number | string; quantity: number;
    variant: { image_path: string | null } | null; product: { images: { storage_path: string; sort_order: number }[] } | null;
  }[];
};

/** The items in the shape the orders page's item list takes. */
const itemInfo = (items: Row['items']): OrderItemInfo[] =>
  items.map((i) => ({ id: i.id, product_name: i.product_name, sku: i.sku ?? '', variant_label: i.variant_label ?? '', unit_price: toNumber(i.unit_price), quantity: i.quantity, image: itemImage(i) }));

/** The item's picture: its variant's photo, else the product's first photo. */
const itemImage = (i: Row['items'][number]) =>
  i.variant?.image_path ?? [...(i.product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;

/** One customer (by phone number): how many orders, and what happened to each. */
export default async function CustomerPage({ params }: { params: Promise<{ phone: string }> }) {
  const [{ supabase, can }, { phone }] = await Promise.all([requirePermission('orders'), params]);
  if (!/^01[0-9]{9}$/.test(phone)) notFound();

  const { data, count, error } = await supabase
    .from('orders')
    .select('id, public_ref, status, total, created_at, customer_name, address, area, district, courier_status, items:order_items(id, product_name, sku, variant_label, unit_price, quantity, variant:product_variants(image_path), product:products(images:product_images(storage_path, sort_order)))', { count: 'exact' })
    .eq('customer_phone', phone)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) console.error('[admin] customer', error);
  const orders = (data ?? []) as unknown as Row[];
  if (!orders.length) notFound();

  const latest = orders[0]!;
  const is = (s: OrderStatus) => orders.filter((o) => o.status === s);
  const pickup = orders.filter((o) => o.status === 'cancelled' && isPickupCancelled(o.courier_status));
  const cards = [
    { label: 'Total orders', value: count ?? orders.length },
    { label: 'Delivered', value: is('delivered').length },
    { label: 'Pickup cancel', value: pickup.length },
    { label: 'Cancelled', value: is('cancelled').length - pickup.length },
    { label: 'Returned', value: is('returned').length },
    { label: 'Spent', value: formatTaka(is('delivered').reduce((sum, o) => sum + toNumber(o.total), 0)) },
  ];

  return (
    <div className="space-y-5">
      <header>
        <Link href="/admin/customers" className="text-sm text-muted hover:text-ink">← Customers</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{latest.customer_name}</h1>
        <p className="font-mono text-sm"><a href={`tel:${phone}`} className="hover:text-brand">{formatBdPhone(phone)}</a></p>
        <p className="text-sm text-muted">{latest.address}{latest.area ? `, ${latest.area}` : ''}, {latest.district}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[12px] text-muted">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-4 py-3 font-semibold">All orders</h2>
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Products</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5">Status</th>{can.has('orders_edit') && <th className="px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold hover:text-brand">{o.public_ref}</Link>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{formatDateTime(o.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  {/* As on the orders page: one overlapping row of pictures; click for the full list. */}
                  <OrderItemsDialog items={itemInfo(o.items)} orderRef={o.public_ref}>
                    <div className="flex w-max items-center -space-x-3">
                      {o.items.slice(0, 3).map((i) => (
                        <span key={i.id} className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-tint shadow-sm ring-1 ring-line transition group-hover/items:ring-brand" title={`${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`}>
                          <ProductImage path={itemImage(i)} alt={i.product_name} sizes="44px" />
                          {i.quantity > 1 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-night px-1 text-[9px] font-bold text-white">×{i.quantity}</span>}
                        </span>
                      ))}
                      {o.items.length > 3 && <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-white bg-night text-[12px] font-bold text-white ring-1 ring-line">+{o.items.length - 3}</span>}
                    </div>
                  </OrderItemsDialog>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">{formatTaka(o.total)}</td>
                <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={o.status} courierStatus={o.courier_status} /></td>
                {can.has('orders_edit') && <td className="px-4 py-3 text-right"><DuplicateOrderButton id={o.id} publicRef={o.public_ref} icon /></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {(count ?? 0) > LIMIT && <p className="border-t border-line px-4 py-3 text-[12.5px] text-muted">Showing the latest {LIMIT} orders.</p>}
      </section>
    </div>
  );
}
