import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderEditorPage } from '@/components/admin/OrderEditorPage';
import { loadVariantOptions } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import type { DeliveryZone } from '@/lib/types';

export const metadata: Metadata = { title: 'New order' };

/** Orders taken by phone, Facebook Messenger, WhatsApp… Stock is reserved like a website order. */
export default async function NewOrderPage() {
  const { supabase } = await requirePermission('orders_edit');
  const [options, { data: zones }] = await Promise.all([
    loadVariantOptions(supabase),
    supabase.from('delivery_zones').select('id, name, charge, free_over, eta_text, sort_order, is_active').order('sort_order'),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">New order</h1>
        <p className="text-sm text-muted">For orders that come by phone, Facebook, WhatsApp or Instagram. Stock is taken as soon as you create it.</p>
      </header>
      <div className="card p-5 sm:p-6">
        <OrderEditorPage options={options} zones={(zones ?? []) as DeliveryZone[]} />
      </div>
    </div>
  );
}
