import type { Metadata } from 'next';
import Link from 'next/link';
import { PackingSlip } from '@/components/admin/PackingSlip';
import { PrintButton } from '@/components/admin/PrintButton';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import type { Order, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Packing slips' };

/** Several packing slips, one per printed page: /admin/orders/slips?ids=a,b,c */
export default async function SlipsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const [{ supabase }, { ids }, settings] = await Promise.all([requirePermission('orders'), searchParams, getSettings()]);
  const list = (ids ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  const { data } = list.length
    ? await supabase.from('orders').select('*, items:order_items(*)').in('id', list).order('created_at')
    : { data: [] };
  const orders = (data ?? []) as (Order & { items: OrderItem[] })[];

  return (
    <div className="space-y-8">
      <div className="no-print mx-auto flex max-w-2xl items-center justify-between">
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
        <span className="text-sm text-muted">{orders.length} slip{orders.length === 1 ? '' : 's'}</span>
        <PrintButton />
      </div>
      {orders.length === 0 ? <p className="text-center text-muted">No orders selected.</p> : orders.map((o) => <PackingSlip key={o.id} order={o} settings={settings} />)}
    </div>
  );
}
