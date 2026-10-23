import Link from 'next/link';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdmin } from '@/lib/auth';
import { PERMISSION_LABEL, isPermission } from '@/lib/permissions';
import { formatDateTime, formatTaka } from '@/lib/format';
import type { Order } from '@/lib/types';

type Stats = {
  today_orders: number;
  week_orders: number;
  today_delivered_revenue: number | null;
  week_delivered_revenue: number | null;
  pending_count: number;
  open_count: number;
  shipped_count: number;
  low_stock_threshold: number;
  low_stock: { variant_id: string; product_id: string; product_name: string; sku: string; variant_label: string; stock: number }[];
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [{ supabase, profile, can }, { denied }] = await Promise.all([requireAdmin(), searchParams]);
  // /admin is also where permission redirects land, so it must render for everyone.
  const [{ data: stats, error }, { data: recent }] = await Promise.all([
    can.has('dashboard') ? supabase.rpc('dashboard_stats') : Promise.resolve({ data: null, error: null }),
    can.has('orders')
      ? supabase
          .from('orders')
          .select('id, public_ref, status, customer_name, total, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) console.error('[admin] dashboard_stats', error);
  const deniedLabels = (denied ?? '').split(',').map((d) => (d === 'staff' ? 'Staff & roles' : isPermission(d) ? PERMISSION_LABEL[d] : null)).filter(Boolean);
  const s = (stats ?? null) as Stats | null;
  const orders = (recent ?? []) as Pick<Order, 'id' | 'public_ref' | 'status' | 'customer_name' | 'total' | 'created_at'>[];

  const cards = s
    ? [
        { label: 'Orders today', value: String(s.today_orders), href: '/admin/orders?range=today' },
        { label: 'Orders, last 7 days', value: String(s.week_orders), href: '/admin/orders?range=7d' },
        ...(s.today_delivered_revenue !== null && s.week_delivered_revenue !== null
          ? [
              { label: 'Delivered revenue today', value: formatTaka(s.today_delivered_revenue), href: '/admin/reports?range=today' },
              { label: 'Delivered revenue, 7 days', value: formatTaka(s.week_delivered_revenue), href: '/admin/reports?range=7d' },
            ]
          : []),
        { label: 'Waiting to confirm', value: String(s.pending_count), href: '/admin/orders?status=pending', highlight: s.pending_count > 0 },
        { label: 'Open orders', value: String(s.open_count), href: '/admin/orders?status=open' },
        { label: 'With courier', value: String(s.shipped_count), href: '/admin/orders?status=shipped' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Hello, {profile.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-muted">Revenue counts delivered orders only, on the day they were delivered (Dhaka time).</p>
      </header>

      {denied && (
        <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
          Your role cannot open that page{deniedLabels.length ? ` (needs: ${deniedLabels.join(', ')})` : ''}. Ask a super admin if you need it.
        </p>
      )}
      {!can.has('dashboard') && <p className="rounded-xl bg-soft px-4 py-3 text-sm text-muted">Use the menu to get to your work.</p>}
      {can.has('dashboard') && !s && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the numbers. Check the server logs.</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`card p-4 transition hover:border-brand ${c.highlight ? 'border-warn/50 bg-warn/5' : ''}`}>
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Latest orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-brand">All orders</Link>
          </div>
          {orders.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Reference</th><th>Customer</th><th>Status</th><th className="text-right">Total</th><th>Placed</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap font-mono font-semibold text-brand">{o.public_ref}</Link></td>
                      <td>{o.customer_name}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right">{formatTaka(o.total)}</td>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Low stock {s ? <span className="text-sm font-normal text-muted">(≤ {s.low_stock_threshold})</span> : null}</h2>
            <Link href="/admin/inventory?low=1" className="text-sm font-semibold text-brand">Inventory</Link>
          </div>
          {!s || s.low_stock.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted">Nothing is running low.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {s.low_stock.map((v) => (
                <li key={v.variant_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <Link href={`/admin/products/${v.product_id}`} className="font-medium hover:underline">{v.product_name}</Link>
                    <span className="text-muted"> · {v.variant_label || v.sku}</span>
                  </span>
                  <span className={`badge ${v.stock === 0 ? 'badge-out' : 'badge-low'}`}>{v.stock === 0 ? 'Sold out' : `${v.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
