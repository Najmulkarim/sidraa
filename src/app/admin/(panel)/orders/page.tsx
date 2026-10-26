import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { OneClickSend } from '@/components/admin/OneClickSend';
import { OrdersTable, type CourierOptions, type OrderRow, type Stat } from '@/components/admin/OrdersTable';
import { DateRangePicker, RANGE_PRESETS } from '@/components/admin/DateRangePicker';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { requirePermission } from '@/lib/auth';
import { escapeLike } from '@/lib/catalog';
import { addDays, dhakaDayStartUtc, dhakaToday, formatTaka, isYmd, resolveRange } from '@/lib/format';
import { isOrderStatus, STATUS_LABEL, type OrderStatus } from '@/lib/order-status';
import type { CourierName } from '@/lib/courier/types';
import type { Staff } from '@/lib/types';

export const metadata: Metadata = { title: 'Orders' };

type SP = Record<string, string | undefined>;
type Tab = { key: string; label: string };

// The tabs across the top, in working order.
const TABS: Tab[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: STATUS_LABEL.pending },
  { key: 'confirmed', label: STATUS_LABEL.confirmed },
  { key: 'processing', label: STATUS_LABEL.processing },
  { key: 'shipped', label: STATUS_LABEL.shipped },
  { key: 'hold', label: STATUS_LABEL.hold },
  { key: 'ship_later', label: STATUS_LABEL.ship_later },
  { key: 'delivered', label: STATUS_LABEL.delivered },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: STATUS_LABEL.cancelled },
  { key: 'returned', label: 'Return' },
  { key: 'lost', label: STATUS_LABEL.lost },
  { key: 'fake', label: STATUS_LABEL.fake },
  { key: 'deleted', label: 'Deleted' },
];
const ROW_OPTIONS = [25, 50, 100];

type Counts = { all: number; deleted: number; paid: number; pending_total: number; by_status: Partial<Record<OrderStatus, number>> };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ supabase, can }, sp] = await Promise.all([requirePermission('orders'), searchParams]);

  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : 'all';
  const q = (sp.q ?? '').trim().slice(0, 60);
  const emp = sp.emp && /^[0-9a-f-]{36}$/i.test(sp.emp) ? sp.emp : '';
  const rows = ROW_OPTIONS.includes(Number(sp.rows)) ? Number(sp.rows) : 25;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  // Date range: this month by default; "all" turns it off.
  const allTime = sp.range === 'all';
  const range = isYmd(sp.from) && isYmd(sp.to) ? resolveRange('custom', sp.from, sp.to) : resolveRange(sp.range ?? 'this-month', undefined, undefined);

  let query = supabase
    .from('orders')
    .select(
      'id, public_ref, status, customer_name, customer_phone, address, area, district, note, total, paid_amount, payment_method, payment_status, assigned_to, deleted_at, created_at, source,' +
        ' courier, courier_consignment_id, courier_tracking_code, courier_status, courier_error,' +
        ' items:order_items(id, product_name, variant_label, quantity, variant:product_variants(image_path), product:products(images:product_images(storage_path, sort_order)))',
      { count: 'exact' },
    );
  if (tab === 'deleted') query = query.not('deleted_at', 'is', null);
  else query = query.is('deleted_at', null);
  if (tab === 'paid') query = query.gt('paid_amount', 0);
  else if (isOrderStatus(tab)) query = query.eq('status', tab);
  if (emp) query = query.eq('assigned_to', emp);
  if (!allTime) query = query.gte('created_at', dhakaDayStartUtc(range.from)).lt('created_at', dhakaDayStartUtc(addDays(range.to, 1)));
  if (q) {
    const digits = q.replace(/\D/g, '');
    // "Order12" or "order 0012" finds Order0012.
    const orderNo = /^order[-\s]*(\d{1,12})$/i.exec(q)?.[1]?.replace(/^0+/, '');
    if (orderNo) query = query.eq('public_ref', `Order${orderNo.padStart(4, '0')}`);
    else if (/^[a-z]{2,4}[-\s]?[0-9a-z]{4}/i.test(q)) query = query.ilike('public_ref', `%${escapeLike(q.toUpperCase().replace(/\s/g, '-'))}%`);
    else if (digits.length >= 4 && digits.length === q.replace(/[\s+-]/g, '').length) query = query.ilike('customer_phone', `%${digits.slice(-11)}%`);
    else query = query.ilike('customer_name', `%${escapeLike(q)}%`);
  }

  const from = (page - 1) * rows;
  const [{ data, count, error }, { data: staffData }, { data: countData }, { data: courierData }] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + rows - 1),
    supabase.rpc('list_staff'),
    supabase.rpc('order_tab_counts', { p_from: allTime ? null : range.from, p_to: allTime ? null : range.to, p_assigned: emp || null }),
    can.has('courier') ? supabase.rpc('courier_options') : Promise.resolve({ data: null }),
  ]);
  if (error) console.error('[admin] orders', error);

  type Raw = Omit<OrderRow, 'items' | 'last_note'> & {
    items: { id: string; product_name: string; variant_label: string; quantity: number; variant: { image_path: string | null } | null; product: { images: { storage_path: string; sort_order: number }[] } | null }[];
  };
  const raw = (data ?? []) as unknown as Raw[];
  const ids = raw.map((o) => o.id);
  const phones = [...new Set(raw.map((o) => o.customer_phone))];

  const [{ data: statData }, { data: noteData }, { data: blockedData }] = await Promise.all([
    phones.length ? supabase.rpc('customer_stats', { p_phones: phones }) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('order_notes').select('order_id, body, created_at').in('order_id', ids).eq('kind', 'note').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    phones.length ? supabase.from('blocked_phones').select('phone').in('phone', phones) : Promise.resolve({ data: [] }),
  ]);

  const lastNote = new Map<string, string>();
  for (const n of (noteData ?? []) as { order_id: string; body: string }[]) if (!lastNote.has(n.order_id)) lastNote.set(n.order_id, n.body);
  const stats: Record<string, Stat> = {};
  for (const s of (statData ?? []) as { phone: string; orders: number; delivered: number; failed: number }[]) {
    stats[s.phone] = { orders: Number(s.orders), delivered: Number(s.delivered), failed: Number(s.failed) };
  }
  const orders: OrderRow[] = raw.map((o) => ({
    ...o,
    last_note: lastNote.get(o.id) ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      product_name: i.product_name,
      variant_label: i.variant_label,
      quantity: i.quantity,
      image: i.variant?.image_path ?? [...(i.product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
    })),
  }));
  const staff = (staffData ?? []) as Staff[];
  const counts = (countData ?? { all: 0, deleted: 0, paid: 0, pending_total: 0, by_status: {} }) as Counts;
  const countOf = (key: string) =>
    key === 'all' ? counts.all : key === 'deleted' ? counts.deleted : key === 'paid' ? counts.paid : (counts.by_status[key as OrderStatus] ?? 0);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / rows));

  // Keeps the current filters when building links.
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { tab, q, emp, rows: rows === 25 ? undefined : rows, ...(allTime ? { range: 'all' } : { from: range.from, to: range.to }), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && !(k === 'tab' && v === 'all') && !(k === 'page' && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  };
  const exportHref = `/admin/export/orders?${new URLSearchParams(allTime ? { from: '2000-01-01', to: range.to } : { from: range.from, to: range.to })}`;

  return (
    <div className="space-y-4 pb-24">
      {/* Toolbar */}
      <section className="rounded-xl border border-line bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Keyed on the filters so the fields reset when a link changes them (uncontrolled inputs keep old values otherwise). */}
          <form key={`${tab}|${q}|${emp}|${allTime ? 'all' : `${range.from}|${range.to}`}|${rows}`} className="contents" action="/admin/orders">
            {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
            {rows !== 25 && <input type="hidden" name="rows" value={rows} />}
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search orders</span>
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={q} placeholder="Search by order ID, phone or name…" className="input min-h-10 pl-9" />
            </label>
            <label className="relative">
              <span className="sr-only">Employee</span>
              <Icon name="user" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select name="emp" defaultValue={emp} className="input min-h-10 w-48 pl-8">
                <option value="">All employees</option>
                {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
              </select>
            </label>
            {!allTime && <input type="hidden" name="range" value={range.preset} />}
            {!allTime && range.preset === 'custom' && <><input type="hidden" name="from" value={range.from} /><input type="hidden" name="to" value={range.to} /></>}
            <button className="btn btn-primary btn-sm min-h-10">Filter</button>
          </form>
          <DateRangePicker
            basePath="/admin/orders"
            preset={allTime ? 'all' : range.preset}
            from={range.from}
            to={range.to}
            today={dhakaToday()}
            presets={[{ value: 'all', label: 'All time' }, ...RANGE_PRESETS]}
            keep={new URLSearchParams(Object.entries({ tab: tab === 'all' ? '' : tab, q, emp, rows: rows === 25 ? '' : String(rows) }).filter(([, v]) => v)).toString()}
          />
          <div className="ml-auto flex items-center gap-1.5">
            <RefreshButton />
            {can.has('orders_edit') && <Link href="/admin/orders/new" className="btn btn-primary btn-sm min-h-10"><Icon name="plus" size={16} /> New order</Link>}
            {can.has('orders_export') && <a href={exportHref} className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink hover:border-brand hover:text-brand" title="Download CSV" aria-label="Download CSV"><Icon name="download" size={18} /></a>}
          </div>
        </div>

        {can.has('courier') && tab !== 'deleted' && (() => {
          const c = (courierData ?? null) as CourierOptions | null;
          const ready = (['steadfast', 'pathao'] as CourierName[]).filter((k) => c?.[k]);
          return ready.length > 0 ? <OneClickSend couriers={ready} defaultCourier={c?.default_courier ?? null} ready={(counts.by_status.confirmed ?? 0) + (counts.by_status.processing ?? 0)} /> : null;
        })()}

        {/* Status tabs */}
        <nav aria-label="Order status" className="mt-3 flex gap-1 overflow-x-auto border-t border-line pt-3 [scrollbar-width:thin]">
          {TABS.map((t) => {
            const active = t.key === tab;
            const n = countOf(t.key);
            return (
              <Link
                key={t.key}
                href={href({ tab: t.key, page: 1 })}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
                  active ? 'border-brand bg-tint text-brand' : 'border-transparent text-ink hover:bg-soft'
                }`}
              >
                {t.label}
                <span className={`rounded-md px-1.5 font-mono text-[11px] font-semibold ${active ? 'bg-brand text-white' : n > 0 && (t.key === 'pending' || t.key === 'returned' || t.key === 'cancelled') ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#eef2ff] text-[#4338ca]'}`}>{n}</span>
                {t.key === 'pending' && counts.pending_total > 0 && <span className="font-mono text-[11px] text-muted">{formatTaka(counts.pending_total)}</span>}
              </Link>
            );
          })}
        </nav>
      </section>

      <OrdersTable
        orders={orders}
        stats={stats}
        staff={staff}
        deletedTab={tab === 'deleted'}
        perms={{ courier: can.has('courier'), del: can.has('orders_delete') }}
        couriers={(courierData ?? null) as CourierOptions | null}
        blocked={((blockedData ?? []) as { phone: string }[]).map((b) => b.phone)}
      />

      {/* Floating pagination */}
      <nav aria-label="Pagination" className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-white px-4 py-2 text-[12px] shadow-[var(--shadow)] lg:left-[calc(50%+7.75rem)]">
        <span className="font-semibold uppercase tracking-wide text-muted">Rows</span>
        <span className="flex gap-1">
          {ROW_OPTIONS.map((r) => (
            <Link key={r} href={href({ rows: r === 25 ? undefined : r, page: 1 })} className={`rounded-md px-2 py-1 font-mono ${r === rows ? 'bg-night text-white' : 'hover:bg-soft'}`}>{r}</Link>
          ))}
        </span>
        <span className="font-mono text-muted">{total === 0 ? '0' : `${from + 1} – ${Math.min(from + rows, total)}`} of {total}</span>
        <span className="flex items-center gap-1">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="grid h-8 w-8 place-items-center rounded-md border border-line hover:border-brand" aria-label="Previous page">‹</Link> : <span className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted/40">‹</span>}
          <span className="grid h-8 min-w-8 place-items-center rounded-md bg-[linear-gradient(105deg,var(--brand),var(--plum))] px-2 font-mono font-bold text-white">{page}</span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="grid h-8 w-8 place-items-center rounded-md border border-line hover:border-brand" aria-label="Next page">›</Link> : <span className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted/40">›</span>}
        </span>
      </nav>
    </div>
  );
}
