import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StockOrderForm, type StockOrderView } from '@/components/admin/StockOrderForm';
import { loadInventoryRows } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Purchase order' };

export default async function StockOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ supabase, can }, { id }, sp] = await Promise.all([requirePermission('inventory'), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const withCost = can.has('catalog') || can.has('revenue');
  const [{ data }, variants] = await Promise.all([
    supabase.from('stock_orders').select('id, ref, status, supplier, supplier_phone, note, expected_on, created_at, received_at, updated_at, items:stock_order_items(variant_id, quantity, unit_cost, new_name, new_color, new_size, new_image, new_price, product_id)').eq('id', id).maybeSingle(),
    loadInventoryRows(supabase, withCost),
  ]);
  if (!data) notFound();
  const raw = data as unknown as Omit<StockOrderView, 'items'> & { updated_at: string; items: (Omit<StockOrderView['items'][number], 'unit_cost' | 'new_price'> & { unit_cost: number | string | null; new_price: number | string | null })[] };
  const order: StockOrderView = { ...raw, items: raw.items.map((i) => ({ ...i, unit_cost: i.unit_cost === null ? null : Number(i.unit_cost), new_price: i.new_price === null ? null : Number(i.new_price) })) };
  const chip = order.status === 'draft' ? 'bg-[#fef3c7] text-[#92400e]' : order.status === 'received' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-soft text-muted';
  return (
    <div className="space-y-5">
      <header>
        <Link href="/admin/inventory/stock-orders" className="text-sm text-muted hover:text-ink">← Purchase orders</Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
          <span className="font-mono">{order.ref}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${chip}`}>{order.status === 'draft' ? 'Draft' : order.status === 'received' ? 'Confirmed' : 'Cancelled'}</span>
        </h1>
        <p className="text-sm text-muted">Made {formatDateTime(order.created_at)}{order.received_at ? ` · confirmed ${formatDateTime(order.received_at)}` : ''}</p>
      </header>
      {sp.created && <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm font-medium text-ok">Saved as a draft. When the goods arrive, press “Confirm”.</p>}
      <StockOrderForm key={raw.updated_at} order={order} variants={variants} withCost={withCost} canSaveCost={can.has('catalog')} />
    </div>
  );
}
