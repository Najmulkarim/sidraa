import type { Metadata } from 'next';
import Link from 'next/link';
import { StockOrderForm } from '@/components/admin/StockOrderForm';
import { loadInventoryRows } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'New stock-in order' };

export default async function NewStockOrderPage() {
  const { supabase, can } = await requirePermission('inventory');
  const withCost = can.has('catalog') || can.has('revenue');
  const variants = await loadInventoryRows(supabase, withCost);
  return (
    <div className="space-y-5">
      <header>
        <Link href="/admin/inventory/stock-orders" className="text-sm text-muted hover:text-ink">← Stock-in orders</Link>
        <h1 className="text-2xl font-bold tracking-tight">New stock-in order</h1>
      </header>
      <StockOrderForm variants={variants} withCost={withCost} canSaveCost={can.has('catalog')} />
    </div>
  );
}
