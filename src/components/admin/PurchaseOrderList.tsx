import Link from 'next/link';
import { formatDate, formatTaka } from '@/lib/format';
import { stockOrderTotals } from '@/lib/inventory';
import type { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;
type PoState = 'draft' | 'pending' | 'confirmed' | 'cancelled';

type Row = {
  id: string; ref: string; status: 'draft' | 'received' | 'cancelled'; supplier: string | null; expected_on: string | null; created_at: string; received_at: string | null;
  items: { quantity: number; unit_cost: number | string | null; received_at: string | null }[];
};

const CHIP: Record<PoState, string> = {
  draft: 'bg-soft text-ink ring-1 ring-line',
  pending: 'bg-[#fef3c7] text-[#92400e]',
  confirmed: 'bg-[#dcfce7] text-[#15803d]',
  cancelled: 'bg-[#fee2e2] text-[#b91c1c]',
};
const LABEL: Record<PoState, string> = { draft: 'Draft', pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled' };

/** Draft: never confirmed. Pending: confirmed, with new lines waiting. Confirmed: everything is in stock. */
function stateOf(o: Row): PoState {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'draft') return 'draft';
  return o.items.some((i) => !i.received_at) ? 'pending' : 'confirmed';
}

/**
 * Every purchase order, newest PO number first, one row each: supplier,
 * products, units, cost and its state. The products themselves are inside
 * each PO. `base`: the page's own link, for the state filter.
 */
export async function PurchaseOrderList({ supabase, withCost, base, state }: { supabase: Db; withCost: boolean; base: string; state?: string }) {
  const { data, error } = await supabase
    .from('stock_orders')
    .select('id, ref, status, supplier, expected_on, created_at, received_at, items:stock_order_items(quantity, unit_cost, received_at)')
    .order('ref', { ascending: false })
    .limit(300);
  if (error) return <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Run the latest database update in Supabase to use purchase orders.</p>;
  const all = ((data ?? []) as unknown as Row[]).map((o) => ({ o, s: stateOf(o) }));
  const filter = (Object.keys(LABEL) as PoState[]).includes(state as PoState) ? (state as PoState) : null;
  const rows = filter ? all.filter((r) => r.s === filter) : all;
  const count = (s: PoState) => all.filter((r) => r.s === s).length;
  const link = (s: PoState | null) => `${base}${base.includes('?') ? '&' : '?'}${s ? `po=${s}` : ''}`.replace(/[?&]$/, '');

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1.5" aria-label="Purchase order state">
        {([null, 'draft', 'pending', 'confirmed', 'cancelled'] as (PoState | null)[]).map((s) => (
          <Link key={s ?? 'all'} href={link(s)} aria-current={filter === s ? 'page' : undefined}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${filter === s ? 'bg-brand text-white' : 'bg-white text-ink ring-1 ring-line hover:ring-brand'}`}>
            {s ? LABEL[s] : 'All'} <span className="font-mono opacity-70">{s ? count(s) : all.length}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">{all.length === 0 ? 'No purchase orders yet' : 'Nothing here'}</p>
          {all.length === 0 && <Link href="/admin/inventory/stock-orders/new" className="btn btn-primary mt-4">Make the first one</Link>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-soft text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">PO number</th>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5 text-right">Products</th>
                <th className="px-3 py-2.5 text-right">Units</th>
                {withCost && <th className="px-3 py-2.5 text-right">Total cost</th>}
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, s }) => {
                const t = stockOrderTotals(o.items.map((i) => ({ quantity: i.quantity, unit_cost: i.unit_cost === null ? null : Number(i.unit_cost) })));
                const waiting = o.items.filter((i) => !i.received_at).reduce((n, i) => n + i.quantity, 0);
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-soft/60">
                    <td className="px-3 py-2.5"><Link href={`/admin/inventory/stock-orders/${o.id}`} className="rounded-md bg-night px-2 py-0.5 font-mono text-[12.5px] font-bold text-white hover:bg-brand">{o.ref}</Link></td>
                    <td className="px-3 py-2.5">{o.supplier ?? <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{t.lines}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{t.units}{s === 'pending' && <span className="block text-[11px] font-normal text-warn">{waiting} pending</span>}</td>
                    {withCost && <td className="px-3 py-2.5 text-right font-mono">{formatTaka(t.cost)}</td>}
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[s]}`}>{LABEL[s]}</span></td>
                    <td className="px-3 py-2.5 text-[12px] text-muted">
                      {s === 'confirmed' || s === 'pending' ? `Confirmed ${formatDate(o.received_at)}` : o.expected_on ? `Expected ${formatDate(o.expected_on)}` : `Made ${formatDate(o.created_at)}`}
                    </td>
                    <td className="px-3 py-2.5 text-right"><Link href={`/admin/inventory/stock-orders/${o.id}`} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold hover:border-brand hover:text-brand">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
