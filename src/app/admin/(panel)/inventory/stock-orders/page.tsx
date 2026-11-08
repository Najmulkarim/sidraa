import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ProductImage } from '@/components/shop/ProductImage';
import { requirePermission } from '@/lib/auth';
import { formatDate, formatTaka } from '@/lib/format';
import { stockOrderTotals } from '@/lib/inventory';

export const metadata: Metadata = { title: 'Stock-in orders' };

type Row = {
  id: string; ref: string; status: 'draft' | 'received' | 'cancelled'; supplier: string | null; expected_on: string | null; created_at: string; received_at: string | null;
  items: { quantity: number; unit_cost: number | string | null; new_image: string | null; variant: { image_path: string | null; product: { images: { storage_path: string; sort_order: number }[] } | null } | null }[];
};
const CHIP = { draft: 'bg-[#fef3c7] text-[#92400e]', received: 'bg-[#dcfce7] text-[#15803d]', cancelled: 'bg-soft text-muted' } as const;
const LABEL = { draft: 'Draft', received: 'Received', cancelled: 'Cancelled' } as const;

/** What the shop ordered from suppliers; receiving one adds it to stock. */
export default async function StockOrdersPage() {
  const { supabase, can } = await requirePermission('inventory');
  const withCost = can.has('catalog') || can.has('revenue');
  const { data, error } = await supabase
    .from('stock_orders')
    .select('id, ref, status, supplier, expected_on, created_at, received_at, items:stock_order_items(quantity, unit_cost, new_image, variant:product_variants(image_path, product:products(images:product_images(storage_path, sort_order))))')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/inventory" className="text-sm text-muted hover:text-ink">← Inventory</Link>
          <h1 className="text-2xl font-bold tracking-tight">Stock-in orders</h1>
          <p className="text-sm text-muted">Orders to your suppliers. Make one as a draft, then press “Receive stock” when the parcel arrives: everything is added to stock at once.</p>
        </div>
        <Link href="/admin/inventory/stock-orders/new" className="btn btn-primary"><Icon name="plus" size={16} /> New stock-in order</Link>
      </header>

      {error && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Run the latest database update (0054) in Supabase to use stock-in orders.</p>}
      {!error && rows.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-semibold">No stock-in orders yet</p>
          <p className="mt-1 text-sm text-muted">For example: 20 scarves and 10 slippers from your supplier, with what each cost.</p>
          <Link href="/admin/inventory/stock-orders/new" className="btn btn-primary mt-4">Make the first one</Link>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-soft text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Items</th>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5 text-right">Units</th>
                {withCost && <th className="px-3 py-2.5 text-right">Total cost</th>}
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const t = stockOrderTotals(o.items.map((i) => ({ quantity: i.quantity, unit_cost: i.unit_cost === null ? null : Number(i.unit_cost) })));
                const photos = o.items.slice(0, 4).map((i) => i.variant?.image_path ?? i.new_image ?? [...(i.variant?.product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null);
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-soft/60">
                    <td className="px-3 py-2.5"><Link href={`/admin/inventory/stock-orders/${o.id}`} className="font-mono font-bold text-ink hover:text-brand">{o.ref}</Link></td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/inventory/stock-orders/${o.id}`} className="flex w-max items-center -space-x-2.5">
                        {photos.map((p, n) => <span key={n} className="relative block h-9 w-9 overflow-hidden rounded-md border-2 border-white bg-tint ring-1 ring-line"><ProductImage path={p} alt="" sizes="36px" /></span>)}
                        {o.items.length > 4 && <span className="relative grid h-9 w-9 place-items-center rounded-md border-2 border-white bg-night text-[11px] font-bold text-white">+{o.items.length - 4}</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">{o.supplier ?? <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{t.units}</td>
                    {withCost && <td className="px-3 py-2.5 text-right font-mono">{formatTaka(t.cost)}</td>}
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CHIP[o.status]}`}>{LABEL[o.status]}</span></td>
                    <td className="px-3 py-2.5 text-[12px] text-muted">
                      {o.status === 'received' && o.received_at ? `Received ${formatDate(o.received_at)}` : o.expected_on ? `Expected ${formatDate(o.expected_on)}` : `Made ${formatDate(o.created_at)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
