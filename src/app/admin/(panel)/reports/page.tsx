import type { Metadata } from 'next';
import { DailyBars } from '@/components/admin/DailyBars';
import { RangeFields } from '@/components/admin/RangeFields';
import { requirePermission } from '@/lib/auth';
import { formatDate, formatTaka, resolveRange } from '@/lib/format';

export const metadata: Metadata = { title: 'Reports' };

type Summary = {
  orders_placed: number;
  orders_placed_value: number;
  delivered_count: number;
  delivered_revenue: number;
  delivered_products: number;
  delivered_delivery: number;
  average_delivered: number;
  cancelled_count: number;
  returned_count: number;
  daily: { day: string; placed: number; delivered_revenue: number }[];
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('revenue'), searchParams]);
  const range = resolveRange(sp.range ?? '30d', sp.from, sp.to);

  const [{ data: summary, error }, { data: products }] = await Promise.all([
    supabase.rpc('report_summary', { p_from: range.from, p_to: range.to }),
    supabase.rpc('report_products', { p_from: range.from, p_to: range.to }),
  ]);
  if (error) console.error('[admin] report_summary', error);
  const s = summary as Summary | null;
  const rows = (products ?? []) as { product_id: string | null; product_name: string; units: number; revenue: number }[];
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();

  const cards = s
    ? [
        { label: 'Delivered revenue', value: formatTaka(s.delivered_revenue), sub: `${formatTaka(s.delivered_products)} products + ${formatTaka(s.delivered_delivery)} delivery` },
        { label: 'Delivered orders', value: String(s.delivered_count), sub: `Average ${formatTaka(s.average_delivered)}` },
        { label: 'Orders placed', value: String(s.orders_placed), sub: `${formatTaka(s.orders_placed_value)} ordered` },
        { label: 'Cancelled', value: String(s.cancelled_count), sub: 'cancelled in this period' },
        { label: 'Returned', value: String(s.returned_count), sub: 'returned in this period' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted">
            {formatDate(range.from)} – {formatDate(range.to)} (Dhaka time). Revenue counts orders on the day they were delivered; returned orders are not revenue.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/export/orders?${qs}`} className="btn btn-outline btn-sm">Orders CSV</a>
          <a href="/admin/export/products" className="btn btn-outline btn-sm">Products CSV</a>
        </div>
      </header>

      <form key={`${range.preset}|${range.from}|${range.to}`} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <RangeFields preset={range.preset} from={range.from} to={range.to} />
        <button className="btn btn-primary">Show</button>
      </form>

      {!s ? (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">The report could not be loaded.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <p className="text-xs text-muted">{c.label}</p>
                <p className="mt-1 text-2xl font-semibold">{c.value}</p>
                <p className="mt-1 text-xs text-muted">{c.sub}</p>
              </div>
            ))}
          </section>

          <section className="card p-5">
            <DailyBars days={s.daily} />
          </section>

          <section className="card overflow-hidden">
            <h2 className="p-4 font-semibold">Products sold (delivered orders)</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted">No delivered orders in this period.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.product_id ?? r.product_name}>
                      <td>{r.product_name}</td>
                      <td className="text-right">{r.units}</td>
                      <td className="text-right font-semibold">{formatTaka(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
