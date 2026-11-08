import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { PurchaseOrderList } from '@/components/admin/PurchaseOrderList';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Purchase orders' };

/** What the shop ordered from suppliers; confirming one adds it to stock. */
export default async function StockOrdersPage({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const [{ supabase, can }, sp] = await Promise.all([requirePermission('inventory'), searchParams]);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/inventory" className="text-sm text-muted hover:text-ink">← Inventory</Link>
          <h1 className="text-2xl font-bold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted">Orders to your suppliers. Draft: not in stock yet. Pending: confirmed, with new products waiting. Confirmed: all in stock. Open one to see its products.</p>
        </div>
        <Link href="/admin/inventory/stock-orders/new" className="btn btn-primary"><Icon name="plus" size={16} /> New purchase order</Link>
      </header>
      <PurchaseOrderList supabase={supabase} withCost={can.has('catalog') || can.has('revenue')} base="/admin/inventory/stock-orders" state={sp.po} />
    </div>
  );
}
