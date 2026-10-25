import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Invoice } from '@/components/admin/Invoice';
import { InvoiceToolbar } from '@/components/admin/InvoiceToolbar';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { isInvoiceTemplate, parseStorefront } from '@/lib/storefront';
import type { Order, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Invoice' };

/** One order's invoice in the default design (Settings → Storefront), or ?t=<design> for this print. */
export default async function SlipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ supabase }, { id }, { t }, settings] = await Promise.all([requirePermission('orders'), params, searchParams, getSettings()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const sf = parseStorefront(settings.storefront);
  const template = isInvoiceTemplate(t) ? t : sf.invoice.template;
  return (
    <div>
      <InvoiceToolbar current={template} hrefFor={(x) => `/admin/orders/${id}/slip?t=${x}`} back="/admin/orders" />
      <Invoice order={data as Order & { items: OrderItem[] }} settings={settings} sf={sf} template={template} />
    </div>
  );
}
