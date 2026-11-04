import type { Metadata } from 'next';
import Link from 'next/link';
import { IncompleteActions } from '@/components/admin/IncompleteActions';
import { Icon } from '@/components/icons';
import { ProductImage } from '@/components/shop/ProductImage';
import { loadVariantOptions } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import { formatDateTime, formatTaka } from '@/lib/format';
import { formatBdPhone } from '@/lib/phone';

export const metadata: Metadata = { title: 'Incomplete orders' };

type Row = {
  id: string; customer_phone: string; customer_name: string | null; address: string | null; district: string | null; area: string | null; note: string | null;
  zone_id: string | null; items: { variant_id: string; quantity: number }[]; status: 'open' | 'converted' | 'cancelled'; order_id: string | null; created_at: string; updated_at: string;
  zone: { name: string; charge: number | string } | null; order: { public_ref: string } | null;
};

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/**
 * Checkouts where the customer typed a valid mobile number but did not order.
 * Call them, then make the order (edit anything first), cancel, or delete.
 */
export default async function IncompleteOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ supabase, can }, sp] = await Promise.all([requirePermission('orders'), searchParams]);
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]['key']) : 'open';
  const [{ data, error }, counts, options] = await Promise.all([
    supabase
      .from('incomplete_orders')
      .select('id, customer_phone, customer_name, address, district, area, note, zone_id, items, status, order_id, created_at, updated_at, zone:delivery_zones(name, charge), order:orders(public_ref)')
      .eq('status', tab)
      .order('updated_at', { ascending: false })
      .limit(300),
    Promise.all(TABS.map((t) => supabase.from('incomplete_orders').select('id', { count: 'exact', head: true }).eq('status', t.key).then((r) => r.count ?? 0))),
    loadVariantOptions(supabase),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const byId = new Map(options.map((o) => [o.variant_id, o]));
  const canConvert = can.has('orders_edit');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incomplete orders</h1>
          <p className="max-w-2xl text-sm text-muted">Customers who entered their mobile number at checkout but did not place the order. Call them, then press <b>Make order</b> (you can change anything first), or cancel or delete it. Customers who finish their order never show here.</p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Show">
        {TABS.map((t, i) => (
          <Link key={t.key} href={t.key === 'open' ? '/admin/incomplete' : `/admin/incomplete?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-night text-white' : 'border border-line bg-white text-ink/75 hover:border-brand hover:text-brand'}`}>
            {t.label} <span className={tab === t.key ? 'text-white/70' : 'text-muted'}>{counts[i]}</span>
          </Link>
        ))}
      </nav>

      {error && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Run the latest database update (0044) in Supabase to use incomplete orders.</p>}
      {!error && rows.length === 0 && (
        <p className="card p-8 text-center text-sm text-muted">{tab === 'open' ? 'No incomplete orders right now.' : 'Nothing cancelled.'}</p>
      )}

      <ul className="grid gap-4 xl:grid-cols-2">
        {rows.map((r) => {
          const lines = (Array.isArray(r.items) ? r.items : []).map((l) => ({ ...l, o: byId.get(l.variant_id) }));
          const subtotal = lines.reduce((n, l) => n + (l.o ? l.o.price * l.quantity : 0), 0);
          const place = [r.address, r.area, r.district].filter(Boolean).join(', ');
          return (
            <li key={r.id} className="card flex min-w-0 flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{r.customer_name || <span className="font-semibold text-muted">No name yet</span>}</p>
                  <a href={`tel:${r.customer_phone}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"><Icon name="phone" size={15} /> {formatBdPhone(r.customer_phone)}</a>
                </div>
                <div className="text-right text-[12.5px] text-muted">
                  <p title={formatDateTime(r.updated_at)}>{ago(r.updated_at)}</p>
                  {r.status === 'converted' && r.order && r.order_id && <Link href={`/admin/orders/${r.order_id}`} className="font-semibold text-ok hover:underline">Order {r.order.public_ref} ↗</Link>}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                {place ? <p className="flex gap-2"><Icon name="pin" size={15} className="mt-0.5 shrink-0 text-muted" /> {place}</p> : <p className="text-muted">No address yet</p>}
                {r.zone && <p className="flex gap-2 text-muted"><Icon name="truck" size={15} className="mt-0.5 shrink-0" /> {r.zone.name} · delivery {formatTaka(r.zone.charge)}</p>}
                {r.note && <p className="flex gap-2 text-muted"><Icon name="note" size={15} className="mt-0.5 shrink-0" /> {r.note}</p>}
              </div>

              <ul className="divide-y divide-line rounded-xl border border-line">
                {lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 p-2.5 text-sm">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={l.o?.image ?? null} alt="" sizes="48px" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.o?.product_name ?? 'Item no longer available'}</span>
                      {l.o?.label && <span className="block text-[12.5px] text-muted">{l.o.label}</span>}
                    </span>
                    <span className="shrink-0 text-right"><span className="text-muted">{l.quantity} ×</span> {l.o ? formatTaka(l.o.price) : '—'}</span>
                  </li>
                ))}
                <li className="flex justify-between p-2.5 text-sm font-semibold"><span>Items total</span><span>{formatTaka(subtotal)}</span></li>
              </ul>

              <IncompleteActions id={r.id} status={r.status} canConvert={canConvert} name={r.customer_name || formatBdPhone(r.customer_phone)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
