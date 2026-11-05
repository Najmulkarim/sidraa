import type { Metadata } from 'next';
import Link from 'next/link';
import { IncompleteList } from '@/components/admin/IncompleteList';
import type { DeliveryZone } from '@/lib/types';
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
  const [{ data, error }, counts, options, { data: zones }] = await Promise.all([
    supabase
      .from('incomplete_orders')
      .select('id, customer_phone, customer_name, address, district, area, note, zone_id, items, status, order_id, created_at, updated_at, zone:delivery_zones(name, charge), order:orders(public_ref)')
      .eq('status', tab)
      .order('updated_at', { ascending: false })
      .limit(300),
    Promise.all(TABS.map((t) => supabase.from('incomplete_orders').select('id', { count: 'exact', head: true }).eq('status', t.key).then((r) => r.count ?? 0))),
    loadVariantOptions(supabase),
    supabase.from('delivery_zones').select('id, name, charge, free_over, eta_text, sort_order, is_active').order('sort_order'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const canConvert = can.has('orders_edit');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incomplete orders</h1>
          <p className="max-w-2xl text-sm text-muted">Customers who entered their mobile number at checkout but did not place the order. Call them, then press <b>Make order</b>, or <b>Edit</b> the address and products first, or cancel or delete it. Customers who finish their order never show here.</p>
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

      {rows.length > 0 && (
        <IncompleteList
          canConvert={canConvert}
          options={options}
          zones={(zones ?? []) as DeliveryZone[]}
          rows={rows.map((r) => ({
            id: r.id, status: r.status, phone: r.customer_phone, phoneText: formatBdPhone(r.customer_phone), name: r.customer_name,
            address: r.address, area: r.area, district: r.district, note: r.note, zoneId: r.zone_id,
            zoneText: r.zone ? `${r.zone.name} · delivery ${formatTaka(r.zone.charge)}` : null,
            items: Array.isArray(r.items) ? r.items : [], ago: ago(r.updated_at), when: formatDateTime(r.updated_at),
          }))}
        />
      )}
    </div>
  );
}
