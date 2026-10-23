import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderEditorPage } from '@/components/admin/OrderEditorPage';
import { loadEditableOrder, loadVariantOptions } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import { isEditable, STATUS_LABEL } from '@/lib/order-status';
import type { DeliveryZone } from '@/lib/types';

export const metadata: Metadata = { title: 'Edit order' };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase }, { id }] = await Promise.all([requirePermission('orders_edit'), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await loadEditableOrder(supabase, id);
  if (!order) notFound();
  const locked = !isEditable(order.status) || !!order.courier_consignment_id;
  const [options, { data: zones }] = locked
    ? [[], { data: [] }]
    : await Promise.all([
        loadVariantOptions(supabase),
        supabase.from('delivery_zones').select('id, name, charge, free_over, eta_text, sort_order, is_active').order('sort_order'),
      ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href={`/admin/orders/${order.id}`} className="text-sm text-muted hover:text-ink">← {order.public_ref}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Edit order</h1>
      </header>
      {locked ? (
        <p className="card p-5 text-sm text-muted">
          This order is {STATUS_LABEL[order.status].toLowerCase()}{order.courier_consignment_id ? ' and already booked with the courier' : ''}, so its items and prices can no longer change.
        </p>
      ) : (
        <div className="card p-5 sm:p-6">
          <OrderEditorPage order={order} options={options} zones={(zones ?? []) as DeliveryZone[]} />
        </div>
      )}
    </div>
  );
}
