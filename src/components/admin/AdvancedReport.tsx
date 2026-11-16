import Link from 'next/link';
import type { ReactNode } from 'react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { ProductReportTable } from '@/components/admin/ReportTables';
import { Icon, type IconName } from '@/components/icons';
import { buildReport, change, OUTCOMES, type Outcome, type ReportOrder } from '@/lib/advanced-report';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';
import { addDays, dhakaDayStartUtc, dhakaToday, formatDate, formatTaka, resolveRange } from '@/lib/format';
import type { createClient } from '@/lib/supabase/server';


type Db = Awaited<ReturnType<typeof createClient>>;
const SELECT = 'id, status, total, created_at, confirmed_at, shipped_at, delivered_at, courier_sent_at, source, landing_slug, coupon_code, district, courier, courier_consignment_id, assigned_to, customer_phone, items:order_items(product_id, product_name, quantity, line_total, unit_cost)';
const MAX = 30_000;

/** Every order placed in the period (deleted ones never count), read 1,000 at a time. */
async function loadOrders(db: Db, from: string, to: string): Promise<ReportOrder[]> {
  const out: ReportOrder[] = [];
  for (let at = 0; at < MAX; at += 1000) {
    const { data, error } = await db.from('orders').select(SELECT).is('deleted_at', null)
      .gte('created_at', dhakaDayStartUtc(from)).lt('created_at', dhakaDayStartUtc(addDays(to, 1)))
      .order('created_at').order('id').range(at, at + 999);
    if (error) { console.error('[admin] report orders', error); break; }
    out.push(...((data ?? []) as unknown as ReportOrder[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** Of these phone numbers, the ones that had ordered before the given day. */
async function returningPhones(db: Db, phones: string[], before: string): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let i = 0; i < phones.length; i += 150) {
    const { data } = await db.from('orders').select('customer_phone').is('deleted_at', null)
      .lt('created_at', dhakaDayStartUtc(before)).in('customer_phone', phones.slice(i, i + 150)).limit(5000);
    for (const r of data ?? []) seen.add(r.customer_phone as string);
  }
  return seen;
}

const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
};

const COLORS: Record<Outcome, string> = { delivered: '#16a34a', active: '#2563eb', returned: '#e11d48', cancelled: '#7c8696' };
const pctText = (v: number | null) => (v === null ? '—' : `${v}%`);

/** The whole report for the period in the URL (default: last 30 days). */
export async function AdvancedReport({ supabase, sp, basePath }: { supabase: Db; sp: Record<string, string | undefined>; basePath: string }) {
  const range = resolveRange(sp.range ?? '30d', sp.from, sp.to, new Date(), 3650);
  const days = daysBetween(range.from, range.to);
  // The same number of days just before, to compare with.
  const prevTo = addDays(range.from, -1);
  const prevFrom = addDays(range.from, -days.length);

  const [orders, prevOrders, { data: productRows }, { data: staffRows }, { data: delivered }] = await Promise.all([
    loadOrders(supabase, range.from, range.to),
    loadOrders(supabase, prevFrom, prevTo),
    supabase.from('products').select('id, category:categories(name), variants:product_variants(stock)').limit(5000),
    supabase.from('admin_profiles').select('user_id, full_name'),
    supabase.rpc('report_summary', { p_from: range.from, p_to: range.to }),
  ]);
  const phones = [...new Set(orders.map((o) => o.customer_phone))];
  const returning = await returningPhones(supabase, phones, range.from);

  type ProductMetaRow = { id: string; category: { name: string } | null; variants: { stock: number }[] };
  const products = new Map(((productRows ?? []) as unknown as ProductMetaRow[]).map((p) => [p.id, { category: p.category?.name ?? null, stock: p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0) : null }]));
  const staffNames = new Map(((staffRows ?? []) as { user_id: string; full_name: string }[]).map((s) => [s.user_id, s.full_name]));

  const r = buildReport(orders, { days, products, returningPhones: returning, staffNames });
  const p = buildReport(prevOrders, { days: [] }).summary;
  const s = r.summary;
  const deliveredRevenue = (delivered as { delivered_revenue?: number } | null)?.delivered_revenue ?? null;
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted">
            Orders placed {formatDate(range.from)} – {formatDate(range.to)} (Dhaka time) and what became of them · compared with the {days.length} day{days.length === 1 ? '' : 's'} before.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker basePath={basePath} preset={range.preset} from={range.from} to={range.to} today={dhakaToday()} />
          <a href={`/admin/export/orders?${qs}`} className="btn btn-outline btn-sm">Orders CSV</a>
          <a href="/admin/export/products" className="btn btn-outline btn-sm">Products CSV</a>
        </div>
      </header>

      {/* Headline numbers, each against the period before. */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon="cart" label="Orders placed" value={String(s.orders)} delta={change(s.orders, p.orders)} sub={`${formatTaka(s.value)} ordered`} />
        <Kpi icon="cash" label="Avg. order value" value={formatTaka(s.aov)} delta={change(s.aov, p.aov)} sub={deliveredRevenue !== null ? `${formatTaka(deliveredRevenue)} delivered in period` : ''} />
        <Kpi icon="chart" label="Gross profit (delivered)" value={formatTaka(s.grossProfit)} delta={change(s.grossProfit, p.grossProfit)}
          sub={s.grossMargin === null ? 'no deliveries yet' : `${s.grossMargin}% margin${s.missingCostUnits ? ` · ${s.missingCostUnits} pcs no cost` : ''}`} />
        <Kpi icon="check" label="Delivery success" value={pctText(s.successRate)} delta={s.successRate !== null && p.successRate !== null ? Math.round((s.successRate - p.successRate) * 10) / 10 : null} points
          sub={`${s.delivered} delivered · ${s.returned} returned`} />
        <Kpi icon="return" label="Return rate" value={pctText(s.returnRate)} delta={s.returnRate !== null && p.returnRate !== null ? Math.round((s.returnRate - p.returnRate) * 10) / 10 : null} points goodDown
          sub="of finished orders" />
        <Kpi icon="ban" label="Cancel rate" value={pctText(s.cancelRate)} delta={s.cancelRate !== null && p.cancelRate !== null ? Math.round((s.cancelRate - p.cancelRate) * 10) / 10 : null} points goodDown
          sub={`${s.cancelled} cancelled · ${s.active} still in progress`} />
        <Kpi icon="user" label="Customers" value={String(s.customers)} delta={change(s.customers, p.customers)}
          sub={s.newCustomers === null ? '' : `${s.newCustomers} new · ${s.returningCustomers} returning`} />
        <Kpi icon="star" label="Repeat customers" value={pctText(s.customers && s.returningCustomers !== null ? Math.round((s.returningCustomers / s.customers) * 1000) / 10 : null)} sub="had ordered before" />
      </section>

      {/* Day by day, split by what became of the orders. */}
      <Card title="Orders per day" icon="chart" note="Each bar is the orders placed that day, coloured by what became of them.">
        <Legend />
        <DailyStack daily={r.daily} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Order journey" icon="truck" note="How far the period's orders got.">
          <Funnel steps={r.funnel} />
        </Card>
        <Card title="Where orders came from" icon="external">
          <MiniTable
            head={['Source', 'Orders', 'Value', 'Success']}
            rows={r.sources.map((x) => [
              { website: 'Website (shop)', landing: 'Landing pages', manual: 'Manual orders', coupon: 'With a coupon' }[x.key],
              String(x.orders), formatTaka(x.value), pctText(x.successRate),
            ])}
          />
          <p className="mt-2 text-[12px] text-muted">Coupon orders are also counted in their own source.</p>
        </Card>
      </div>

      <Card title="Products" icon="box" note="Ordered in the period; income, profit and margin from the ones delivered. Click a column to sort.">
        {r.products.length ? <ProductReportTable rows={r.products} money /> : <Empty />}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Categories" icon="tag">
          {r.categories.length ? (
            <MiniTable head={['Category', 'Units', 'Ordered', 'Profit', 'Return']}
              rows={r.categories.map((c) => [c.name, String(c.units), formatTaka(c.value), formatTaka(c.profit), pctText(c.returnRate)])} />
          ) : <Empty />}
        </Card>
        <Card title="Districts" icon="truck" note="Low success = many returns from there.">
          {r.districts.length ? (
            <MiniTable head={['District', 'Orders', 'Value', 'Success']}
              rows={r.districts.slice(0, 15).map((d) => [d.name, String(d.orders), formatTaka(d.value), <Rate key="r" v={d.successRate} />])} />
          ) : <Empty />}
        </Card>
      </div>

      <Card title="When customers order" icon="clock" note="Orders by day and hour (Dhaka time). Darker = more orders — good times to run ads.">
        <Heatmap heat={r.heat} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Staff" icon="user" note="Orders assigned to each person.">
          {r.staff.length ? (
            <MiniTable head={['Staff', 'Orders', 'Delivered', 'Success', 'Cancel']}
              rows={r.staff.map((x) => [x.name, String(x.orders), String(x.delivered), <Rate key="r" v={x.successRate} />, pctText(x.cancelRate)])} />
          ) : <Empty />}
        </Card>
        <Card title="Couriers" icon="truck">
          {r.couriers.length ? (
            <MiniTable head={['Courier', 'Sent', 'Delivered', 'Returned', 'Success', 'Days']}
              rows={r.couriers.map((c) => [COURIER_LABEL[c.name as CourierName] ?? c.name, String(c.sent), String(c.delivered), String(c.returned), <Rate key="r" v={c.successRate} />, c.avgDays === null ? '—' : `${c.avgDays}`])} />
          ) : <Empty text="No parcels sent to a courier in this period." />}
          <p className="mt-2 text-[12px] text-muted">Days = average from handing over to delivery.</p>
        </Card>
      </div>

      <p className="text-[12px] text-muted">
        Profit here is product income minus product cost. For the full profit &amp; loss with courier charges, COD fees and expenses, see <Link href="/admin/accounting" className="underline">Accounting</Link>.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, sub, delta, points = false, goodDown = false }: { icon: IconName; label: string; value: string; sub?: string; delta?: number | null; points?: boolean; goodDown?: boolean }) {
  const good = delta === null || delta === undefined || delta === 0 ? null : goodDown ? delta < 0 : delta > 0;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><Icon name={icon} size={14} /> {label}</p>
        {delta !== undefined && delta !== null && (
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${good === null ? 'bg-soft text-muted' : good ? 'bg-ok/12 text-ok' : 'bg-bad/10 text-bad'}`}
            title="Change from the period before">
            {delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {Math.abs(delta)}{points ? ' pts' : '%'}
          </span>
        )}
      </div>
      <p className="mt-1 text-[1.6rem] font-bold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

function Card({ title, icon, note, children }: { title: string; icon: IconName; note?: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-tint text-brand"><Icon name={icon} size={16} /></span>
        <div>
          <h2 className="font-semibold leading-tight">{title}</h2>
          {note && <p className="text-[12px] text-muted">{note}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({ text = 'No orders in this period.' }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-muted">{text}</p>;
}

function Rate({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted">—</span>;
  return <span className={`font-semibold ${v >= 85 ? 'text-ok' : v >= 70 ? 'text-warn' : 'text-bad'}`}>{v}%</span>;
}

function MiniTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[11px] font-bold uppercase tracking-wide text-muted">
          <tr>{head.map((h, i) => <th key={h} className={`pb-2 ${i ? 'text-right' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((row, i) => (
            <tr key={i}>{row.map((c, j) => <td key={j} className={`py-2 ${j ? 'whitespace-nowrap pl-3 text-right' : 'max-w-[200px] truncate font-medium'}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink/80">
      {OUTCOMES.map((o) => (
        <li key={o.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS[o.key] }} aria-hidden /> {o.label}</li>
      ))}
    </ul>
  );
}

/** Stacked bars per day; hover a bar for its numbers. */
function DailyStack({ daily }: { daily: { day: string; orders: number; delivered: number; returned: number; cancelled: number; active: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.orders));
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const step = Math.max(1, Math.ceil(daily.length / 12));
  return (
    <div>
      <div className="flex h-48 items-end gap-[2px]" role="img" aria-label={`Orders per day, highest ${max}`}>
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${fmt.format(new Date(`${d.day}T00:00:00Z`))}: ${d.orders} orders — ${d.delivered} delivered, ${d.active} in progress, ${d.returned} returned, ${d.cancelled} cancelled`}>
            <div className="flex w-full flex-col-reverse gap-[1px] overflow-hidden rounded-t-[4px]" style={{ height: `${(d.orders / max) * 100}%` }}>
              {(['delivered', 'active', 'returned', 'cancelled'] as const).map((k) => d[k] > 0 && (
                <span key={k} style={{ height: `${(d[k] / d.orders) * 100}%`, background: COLORS[k] }} className="block w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10.5px] text-muted">
        {daily.map((d, i) => <span key={d.day} className="min-w-0 flex-1 truncate text-center">{i % step === 0 ? fmt.format(new Date(`${d.day}T00:00:00Z`)) : ''}</span>)}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; count: number }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((st, i) => {
        const share = Math.round((st.count / top) * 100);
        const fromPrev = i > 0 && steps[i - 1]!.count ? Math.round((st.count / steps[i - 1]!.count) * 100) : null;
        return (
          <li key={st.label}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{st.label}</span>
              <span><b>{st.count}</b> <span className="text-muted">· {share}%{fromPrev !== null ? ` (${fromPrev}% of step before)` : ''}</span></span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(share, st.count ? 2 : 0)}%`, opacity: 1 - i * 0.15 }} /></div>
          </li>
        );
      })}
    </ol>
  );
}

/** Seven rows (Sat–Fri, the Bangladesh week) by 24 hours. */
function Heatmap({ heat }: { heat: number[][] }) {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(1, ...heat.flat());
  const busiest = heat.flatMap((row, d) => row.map((v, h) => ({ v, d, h }))).sort((a, b) => b.v - a.v)[0];
  const hourName = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-muted">
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 === 0 ? hourName(h) : ''}</span>)}
          {order.map((d) => (
            <div key={d} className="contents">
              <span className="self-center text-[11px] font-medium">{names[d]}</span>
              {heat[d]!.map((v, h) => (
                <span key={h} className="aspect-square rounded-[3px]" title={`${names[d]} ${hourName(h)}: ${v} order${v === 1 ? '' : 's'}`}
                  style={{ background: v ? `rgba(225, 29, 72, ${0.12 + (v / max) * 0.88})` : 'var(--color-soft)' }} />
              ))}
            </div>
          ))}
        </div>
        {busiest && busiest.v > 0 && <p className="mt-3 text-[12.5px] text-muted">Busiest: <b className="text-ink">{names[busiest.d]} around {hourName(busiest.h)}</b> ({busiest.v} orders).</p>}
      </div>
    </div>
  );
}
