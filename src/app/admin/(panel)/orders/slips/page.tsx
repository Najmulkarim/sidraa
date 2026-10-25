import type { Metadata } from 'next';
import { Invoice } from '@/components/admin/Invoice';
import { InvoiceToolbar } from '@/components/admin/InvoiceToolbar';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { isInvoiceTemplate, parseStorefront } from '@/lib/storefront';
import type { Order, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Invoices' };

/** Several invoices for printing: /admin/orders/slips?ids=a,b,c (&t=<design> to override the default). */
export default async function SlipsPage({ searchParams }: { searchParams: Promise<{ ids?: string; t?: string }> }) {
  const [{ supabase }, { ids, t }, settings] = await Promise.all([requirePermission('orders'), searchParams, getSettings()]);
  const list = (ids ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  const { data } = list.length
    ? await supabase.from('orders').select('*, items:order_items(*)').in('id', list).order('created_at')
    : { data: [] };
  const orders = (data ?? []) as (Order & { items: OrderItem[] })[];
  const sf = parseStorefront(settings.storefront);
  const template = isInvoiceTemplate(t) ? t : sf.invoice.template;

  return (
    <div className="space-y-8 print:space-y-0">
      <InvoiceToolbar current={template} hrefFor={(x) => `/admin/orders/slips?ids=${list.join(',')}&t=${x}`} count={orders.length} back="/admin/orders" />
      {orders.length === 0 ? <p className="text-center text-muted">No orders selected.</p> : orders.map((o) => <Invoice key={o.id} order={o} settings={settings} sf={sf} template={template} />)}
    </div>
  );
}
