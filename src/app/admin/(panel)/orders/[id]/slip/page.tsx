import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PackingSlip } from '@/components/admin/PackingSlip';
import { PrintButton } from '@/components/admin/PrintButton';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import type { Order, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Packing slip' };

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase }, { id }, settings] = await Promise.all([requirePermission('orders'), params, getSettings()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  return (
    <div>
      <div className="no-print mx-auto mb-6 flex max-w-2xl justify-end"><PrintButton /></div>
      <PackingSlip order={data as Order & { items: OrderItem[] }} settings={settings} />
    </div>
  );
}
