import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ProductImage } from '@/components/shop/ProductImage';
import { requireAdmin } from '@/lib/auth';
import { PERMISSION_LABEL, isPermission } from '@/lib/permissions';
import { formatDate, formatDateTime, formatTaka, resolveRange } from '@/lib/format';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/order-status';
import { maskBdPhone } from '@/lib/phone';
import type { Order } from '@/lib/types';

type Stats = {
  pending_count: number;
  low_stock_threshold: number;
  low_stock: { variant_id: string; product_id: string; product_name: string; sku: string; variant_label: string; stock: number }[];
};

type Money = number | null;
type Report = {
  from: string;
  to: string;
  money: boolean;
  total_orders: number;
  prev_total_orders: number;
  sales: Money;
  prev_sales: Money;
  valid_orders: number;
  active_orders: number;
  active_value: Money;
  delivered_orders: number;
  delivered_value: Money;
  cancelled_orders: number;
  cancelled_value: Money;
  returned_orders: number;
  status_counts: Partial<Record<OrderStatus, number>>;
  breakdown: { gross: number; discount: number; delivery: number; returns: number; net: number } | null;
  customers: number;
  returning_customers: number;
  daily: { day: string; orders: number; sales: Money }[];
  districts: { district: string; orders: number; sales: Money }[];
  categories: { category: string; units: number; sales: Money }[];
  top_products: { product_id: string | null; name: string; image: string | null; units: number; orders: number; sales: Money }[];
  top_customers: { name: string; phone: string; orders: number; spent: Money }[];
  product_report: {
    product_id: string | null; sku: string | null; name: string; image: string | null;
    orders: number; value: Money; cancelled: number; cancelled_value: Money; pending: number; pending_value: Money;
  }[];
};

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
];

/** One colour per order status, used by the donut and its legend. */
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#6366f1',
  confirmed: '#0ea5e9',
  processing: '#8b5cf6',
  hold: '#f59e0b',
  ship_later: '#14b8a6',
  shipped: '#3b82f6',
  delivered: '#16a34a',
  cancelled: '#ef4444',
  returned: '#f97316',
  lost: '#64748b',
  fake: '#a1a1aa',
};
const CATEGORY_COLORS = ['#e30363', '#6366f1', '#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f97316', '#14b8a6'];

const n = (v: number | string | null | undefined) => Number(v ?? 0);

function change(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return now ? { text: 'new', up: true } : null;
  const pct = ((now - before) / before) * 100;
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 };
}

function Card({ title, icon, children, action, className = '' }: { title: string; icon?: IconName; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          {icon && <Icon name={icon} size={16} className="text-brand" />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Delta({ value }: { value: { text: string; up: boolean } | null }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${value.up ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
      {value.up ? '▲' : '▼'} {value.text}
    </span>
  );
}

function Stat({ label, value, sub, href, icon, tone }: { label: string; value: string; sub?: ReactNode; href: string; icon: IconName; tone: string }) {
  return (
    <Link href={href} className="card group flex min-w-0 items-start gap-3 p-4 transition hover:border-brand">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: tone }}>
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-muted">{label}</span>
        <span className="block text-2xl font-bold leading-tight">{value}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

/** Bars for each day; height is orders, or sales when money is visible. */
function DailyChart({ daily, money }: { daily: Report['daily']; money: boolean }) {
  const values = daily.map((d) => (money ? n(d.sales) : d.orders));
  const max = Math.max(1, ...values);
  const step = Math.max(1, Math.ceil(daily.length / 6));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {daily.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[3px] bg-[linear-gradient(180deg,var(--brand),var(--accent))] opacity-85 transition group-hover:opacity-100" style={{ height: `${Math.max(2, (values[i]! / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-night px-2 py-1 text-[11px] text-white group-hover:block">
              {formatDate(d.day)} · {d.orders} order{d.orders === 1 ? '' : 's'}{money ? ` · ${formatTaka(d.sales)}` : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted">
        {daily.filter((_, i) => i % step === 0 || i === daily.length - 1).map((d) => <span key={d.day}>{d.day.slice(5).replace('-', '/')}</span>)}
      </div>
    </div>
  );
}

function Donut({ counts, total }: { counts: Report['status_counts']; total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const parts = ORDER_STATUSES.filter((s) => n(counts[s]) > 0).map((s) => {
    const len = (n(counts[s]) / Math.max(1, total)) * C;
    const part = { s, len, offset };
    offset += len;
    return part;
  });
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={`${total} orders by status`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
        {parts.map((p) => (
          <circle key={p.s} cx="70" cy="70" r={R} fill="none" stroke={STATUS_COLOR[p.s]} strokeWidth="16" strokeDasharray={`${p.len} ${C - p.len}`} strokeDashoffset={-p.offset} />
        ))}
        <text x="70" y="66" textAnchor="middle" className="fill-[var(--muted)] text-[10px]" transform="rotate(90 70 70)">Total</text>
        <text x="70" y="86" textAnchor="middle" className="fill-[var(--ink)] text-[22px] font-bold" transform="rotate(90 70 70)">{total}</text>
      </svg>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        {ORDER_STATUSES.map((s) => (
          <li key={s} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>
            <Link href={`/admin/orders?status=${s}`} className="font-semibold tabular-nums hover:text-brand">{n(counts[s])}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string; range?: string; from?: string; to?: string }> }) {
  const [{ supabase, profile, can }, sp] = await Promise.all([requireAdmin(), searchParams]);
  const range = resolveRange(sp.range ?? '30d', sp.from, sp.to);
  // /admin is also where permission redirects land, so it must render for everyone.
  const [{ data: report, error }, { data: stats }, { data: recent }] = await Promise.all([
    can.has('dashboard') ? supabase.rpc('dashboard_report', { p_from: range.from, p_to: range.to }) : Promise.resolve({ data: null, error: null }),
    can.has('dashboard') ? supabase.rpc('dashboard_stats') : Promise.resolve({ data: null }),
    can.has('orders')
      ? supabase.from('orders').select('id, public_ref, status, customer_name, total, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) console.error('[admin] dashboard_report', error);
  const deniedLabels = (sp.denied ?? '').split(',').map((d) => (d === 'staff' ? 'Staff & roles' : isPermission(d) ? PERMISSION_LABEL[d] : null)).filter(Boolean);
  const r = (report ?? null) as Report | null;
  const s = (stats ?? null) as Stats | null;
  const orders = (recent ?? []) as Pick<Order, 'id' | 'public_ref' | 'status' | 'customer_name' | 'total' | 'created_at'>[];
  const money = !!r?.money;
  const qs = (extra: string) => `range=${range.preset}${range.preset === 'custom' ? `&from=${range.from}&to=${range.to}` : ''}${extra}`;
  const ordersHref = (status?: string) => `/admin/orders?range=custom&from=${range.from}&to=${range.to}${status ? `&status=${status}` : ''}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hello, {profile.full_name.split(' ')[0]}</h1>
          <p className="text-sm text-muted">
            {formatDate(range.from)} – {formatDate(range.to)} · orders placed in this period (Dhaka time)
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-1.5" action="/admin">
          {PRESETS.map((p) => (
            <Link
              key={p.value}
              href={`/admin?range=${p.value}`}
              aria-current={range.preset === p.value ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${range.preset === p.value ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white shadow' : 'bg-card text-ink ring-1 ring-line hover:ring-brand'}`}
            >
              {p.label}
            </Link>
          ))}
          <input type="hidden" name="range" value="custom" />
          <input name="from" type="date" defaultValue={range.from} aria-label="From" className="input !min-h-8 w-[8.5rem] !py-1 !text-[12.5px]" />
          <input name="to" type="date" defaultValue={range.to} aria-label="To" className="input !min-h-8 w-[8.5rem] !py-1 !text-[12.5px]" />
          <button className="btn btn-sm btn-outline !min-h-8">Go</button>
        </form>
      </header>

      {sp.denied && (
        <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
          Your role cannot open that page{deniedLabels.length ? ` (needs: ${deniedLabels.join(', ')})` : ''}. Ask a super admin if you need it.
        </p>
      )}
      {!can.has('dashboard') && <p className="rounded-xl bg-soft px-4 py-3 text-sm text-muted">Use the menu to get to your work.</p>}
      {can.has('dashboard') && !r && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the numbers. If this is new, run the latest database update (0015) in Supabase.</p>}
      {s && s.pending_count > 0 && (
        <Link href="/admin/orders?status=pending" className="flex items-center justify-between gap-3 rounded-2xl bg-[linear-gradient(105deg,var(--night),var(--plum))] px-4 py-3 text-white shadow-[var(--shadow)]">
          <span className="flex items-center gap-2 text-sm font-semibold"><Icon name="clock" size={18} /> {s.pending_count} new order{s.pending_count === 1 ? '' : 's'} waiting to be confirmed</span>
          <span className="text-[12.5px] font-semibold underline">Open</span>
        </Link>
      )}

      {r && (
        <>
          {/* Row 1: sales chart + the four order counts */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card title={money ? 'Total sales' : 'Orders per day'} icon="chart" action={<Delta value={money ? change(n(r.sales), n(r.prev_sales)) : change(r.total_orders, r.prev_total_orders)} />}>
              <p className="mb-3 text-3xl font-bold">
                {money ? formatTaka(r.sales) : r.total_orders}
                <span className="ml-2 text-[13px] font-medium text-muted">{money ? `from ${r.valid_orders} order${r.valid_orders === 1 ? '' : 's'}` : 'orders'}</span>
              </p>
              <DailyChart daily={r.daily} money={money} />
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total orders" value={String(r.total_orders)} sub={<Delta value={change(r.total_orders, r.prev_total_orders)} />} href={ordersHref()} icon="cart" tone="linear-gradient(135deg,#6366f1,#8b5cf6)" />
              <Stat label="Active orders" value={String(r.active_orders)} sub={money ? formatTaka(r.active_value) : 'in progress'} href="/admin/orders?status=open" icon="clock" tone="linear-gradient(135deg,#0ea5e9,#3b82f6)" />
              <Stat label="Completed" value={String(r.delivered_orders)} sub={money ? formatTaka(r.delivered_value) : 'delivered'} href={ordersHref('delivered')} icon="check" tone="linear-gradient(135deg,#16a34a,#22c55e)" />
              <Stat label="Cancelled" value={String(r.cancelled_orders)} sub={money ? formatTaka(r.cancelled_value) : 'incl. fake'} href={ordersHref('cancelled')} icon="ban" tone="linear-gradient(135deg,#ef4444,#f97316)" />
            </div>
          </div>

          {/* Row 2: customers + status donut */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Customer insights" icon="users">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-soft p-3">
                  <dt className="text-[11.5px] text-muted">Customers</dt>
                  <dd className="text-xl font-bold">{r.customers}</dd>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <dt className="text-[11.5px] text-muted">Returning</dt>
                  <dd className="text-xl font-bold">{r.customers ? Math.round((r.returning_customers / r.customers) * 100) : 0}%</dd>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <dt className="text-[11.5px] text-muted">Avg. order</dt>
                  <dd className="text-xl font-bold">{money && r.valid_orders ? formatTaka(Math.round(n(r.sales) / r.valid_orders)) : '—'}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[12px] text-muted">
                Returning = ordered more than once, or had ordered before this period. {r.returned_orders > 0 && <>Returned orders in this period: <b>{r.returned_orders}</b>.</>}
              </p>
            </Card>
            <Card title="Order count by status" icon="layers">
              <Donut counts={r.status_counts} total={r.total_orders} />
            </Card>
          </div>

          {/* Row 3: money breakdown + districts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {money && r.breakdown && (
              <Card title="Total sales breakdown" icon="cash">
                <dl className="divide-y divide-line text-[13.5px]">
                  {[
                    ['Gross sales (products)', formatTaka(r.breakdown.gross), ''],
                    ['Discounts', `−${formatTaka(r.breakdown.discount)}`, 'text-bad'],
                    ['Delivery charge', `+${formatTaka(r.breakdown.delivery)}`, ''],
                    ['Returned orders (not counted)', formatTaka(r.breakdown.returns), 'text-muted'],
                  ].map(([k, v, cls]) => (
                    <div key={k} className="flex justify-between py-2"><dt className="text-muted">{k}</dt><dd className={`font-semibold tabular-nums ${cls}`}>{v}</dd></div>
                  ))}
                  <div className="flex justify-between py-2.5 text-[15px]"><dt className="font-bold">Net sales</dt><dd className="font-bold tabular-nums text-brand-ink">{formatTaka(r.breakdown.net)}</dd></div>
                </dl>
              </Card>
            )}
            <Card title="Top districts" icon="pin" className={money ? '' : 'lg:col-span-2'}>
              {r.districts.length === 0 ? <p className="text-sm text-muted">No orders in this period.</p> : (
                <ul className="space-y-2.5">
                  {r.districts.map((d) => (
                    <li key={d.district}>
                      <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{d.district}</span><span className="tabular-nums text-muted">{d.orders} order{d.orders === 1 ? '' : 's'}{money ? ` · ${formatTaka(d.sales)}` : ''}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#8b5cf6)]" style={{ width: `${(d.orders / Math.max(1, r.districts[0]!.orders)) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Row 4: categories, top products, top customers */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Sales by category" icon="grid">
              {r.categories.length === 0 ? <p className="text-sm text-muted">No sales in this period.</p> : (() => {
                const total = r.categories.reduce((t, c) => t + (money ? n(c.sales) : n(c.units)), 0) || 1;
                return (
                  <>
                    <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-soft">
                      {r.categories.map((c, i) => <div key={c.category} style={{ width: `${((money ? n(c.sales) : n(c.units)) / total) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />)}
                    </div>
                    <ul className="space-y-1.5 text-[13px]">
                      {r.categories.map((c, i) => (
                        <li key={c.category} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} /><span className="truncate">{c.category}</span></span>
                          <span className="shrink-0 tabular-nums text-muted">{money ? formatTaka(c.sales) : `${c.units} pcs`} · {Math.round(((money ? n(c.sales) : n(c.units)) / total) * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </Card>
            <Card title="Top products" icon="box">
              {r.top_products.length === 0 ? <p className="text-sm text-muted">No sales in this period.</p> : (
                <ul className="space-y-2.5">
                  {r.top_products.map((p, i) => (
                    <li key={p.product_id ?? p.name} className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-soft"><ProductImage path={p.image} alt="" sizes="40px" /></span>
                      <span className="min-w-0 flex-1">
                        {p.product_id ? <Link href={`/admin/products/${p.product_id}`} className="line-clamp-1 text-[13px] font-medium hover:text-brand">{p.name}</Link> : <span className="line-clamp-1 text-[13px] font-medium">{p.name}</span>}
                        <span className="text-[12px] text-muted">{p.units} sold · {p.orders} order{p.orders === 1 ? '' : 's'}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12.5px] font-semibold tabular-nums">{money ? formatTaka(p.sales) : `#${i + 1}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Top customers" icon="user">
              {r.top_customers.length === 0 ? <p className="text-sm text-muted">No customers in this period.</p> : (
                <ul className="space-y-2.5">
                  {r.top_customers.map((c, i) => (
                    <li key={c.phone} className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: CATEGORY_COLORS[(i + 1) % CATEGORY_COLORS.length] }}>
                        {c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/admin/orders?q=${c.phone}`} className="line-clamp-1 text-[13px] font-medium hover:text-brand">{c.name}</Link>
                        <span className="text-[12px] text-muted">{maskBdPhone(c.phone)}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] tabular-nums">
                        <span className="block font-semibold">{c.orders} order{c.orders === 1 ? '' : 's'}</span>
                        {money && <span className="text-muted">{formatTaka(c.spent)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Row 5: product report */}
          <Card title="Product report" icon="note" action={money ? <Link href={`/admin/reports?${qs('')}`} className="btn btn-outline btn-sm">See full report</Link> : undefined}>
            {r.product_report.length === 0 ? <p className="text-sm text-muted">No orders in this period.</p> : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="table min-w-[640px]">
                  <thead>
                    <tr><th>SKU</th><th>Product</th><th className="text-right">Orders</th>{money && <th className="text-right">Order value</th>}<th className="text-right">Cancelled / returned</th><th className="text-right">In progress</th></tr>
                  </thead>
                  <tbody>
                    {r.product_report.map((p) => (
                      <tr key={p.product_id ?? p.name}>
                        <td className="whitespace-nowrap font-mono text-[12px] font-semibold text-brand-ink">{p.sku ?? '—'}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-soft"><ProductImage path={p.image} alt="" sizes="32px" /></span>
                            {p.product_id ? <Link href={`/admin/products/${p.product_id}`} className="line-clamp-1 hover:text-brand">{p.name}</Link> : <span className="line-clamp-1">{p.name}</span>}
                          </span>
                        </td>
                        <td className="bg-[#6366f1]/5 text-right font-semibold tabular-nums">{p.orders}</td>
                        {money && <td className="bg-[#16a34a]/5 text-right tabular-nums">{formatTaka(p.value)}</td>}
                        <td className="bg-bad/5 text-right tabular-nums">{p.cancelled}{money ? ` (${formatTaka(p.cancelled_value)})` : ''}</td>
                        <td className="bg-[#0ea5e9]/5 text-right tabular-nums">{p.pending}{money ? ` (${formatTaka(p.pending_value)})` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Low stock + latest orders */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {can.has('orders') && (
          <Card title="Latest orders" icon="cart" action={<Link href="/admin/orders" className="text-[12.5px] font-semibold text-brand">All orders</Link>}>
            {orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="text-right">Total</th><th>Placed</th></tr></thead>
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
          </Card>
        )}
        {s && (
          <Card title={`Low stock (≤ ${s.low_stock_threshold})`} icon="tag" action={<Link href="/admin/inventory?low=1" className="text-[12.5px] font-semibold text-brand">Inventory</Link>}>
            {s.low_stock.length === 0 ? <p className="text-sm text-muted">Nothing is running low.</p> : (
              <ul className="divide-y divide-line text-sm">
                {s.low_stock.map((v) => (
                  <li key={v.variant_id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link href={`/admin/products/${v.product_id}`} className="font-medium hover:underline">{v.product_name}</Link>
                      <span className="text-muted"> · {v.variant_label || v.sku}</span>
                    </span>
                    <span className={`badge shrink-0 ${v.stock === 0 ? 'badge-out' : 'badge-low'}`}>{v.stock === 0 ? 'Sold out' : `${v.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
