import type { Metadata } from 'next';
import Link from 'next/link';
import type { OrderPrefill } from '@/components/admin/OrderEditor';
import { OrderEditorPage } from '@/components/admin/OrderEditorPage';
import { loadVariantOptions } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import type { DeliveryZone } from '@/lib/types';

export const metadata: Metadata = { title: 'New order' };

type Draft = { customer_phone: string; customer_name: string | null; address: string | null; district: string | null; area: string | null; note: string | null; zone_id: string | null; items: { variant_id: string; quantity: number }[]; status: string };

/** Orders taken by phone, Facebook Messenger, WhatsApp… Stock is reserved like a website order. ?draft= starts from an incomplete order. */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('orders_edit'), searchParams]);
  const draftId = sp.draft && /^[0-9a-f-]{36}$/i.test(sp.draft) ? sp.draft : undefined;
  const [options, { data: zones }, { data: draft }] = await Promise.all([
    loadVariantOptions(supabase),
    supabase.from('delivery_zones').select('id, name, charge, free_over, eta_text, sort_order, is_active').order('sort_order'),
    draftId
      ? supabase.from('incomplete_orders').select('customer_phone, customer_name, address, district, area, note, zone_id, items, status').eq('id', draftId).maybeSingle<Draft>()
      : Promise.resolve({ data: null }),
  ]);
  const byId = new Map(options.map((o) => [o.variant_id, o]));
  // Items still on sale come in at today's price; the rest are left out (the editor shows what is in stock).
  const prefill: OrderPrefill | undefined = draft
    ? {
        customerName: draft.customer_name ?? '',
        customerPhone: draft.customer_phone,
        address: draft.address ?? '',
        district: draft.district ?? '',
        area: draft.area ?? '',
        note: draft.note ?? '',
        zoneId: draft.zone_id,
        source: 'website',
        lines: (Array.isArray(draft.items) ? draft.items : []).filter((l) => byId.has(l.variant_id)).map((l) => ({ variantId: l.variant_id, quantity: l.quantity, unitPrice: byId.get(l.variant_id)!.price })),
      }
    : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{prefill ? 'Make order from incomplete checkout' : 'New order'}</h1>
        <p className="text-sm text-muted">{prefill ? 'What the customer entered is filled in. Check it with them, change anything, then create the order. Stock is taken as soon as you create it.' : 'For orders that come by phone, Facebook, WhatsApp or Instagram. Stock is taken as soon as you create it.'}</p>
        {draft && draft.status !== 'open' && <p className="mt-2 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">This incomplete order is already {draft.status === 'converted' ? 'an order' : 'cancelled'}.</p>}
      </header>
      <div className="card p-5 sm:p-6">
        <OrderEditorPage key={draftId ?? 'new'} prefill={prefill} draftId={draft ? draftId : undefined} options={options} zones={(zones ?? []) as DeliveryZone[]} />
      </div>
    </div>
  );
}
