import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { ProductImage } from '@/components/shop/ProductImage';
import { loadInventoryRows } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { MOVEMENT_REASONS, type MovementKind } from '@/lib/inventory';

export const metadata: Metadata = { title: 'Inventory' };

const TABS = [
  { key: 'summary', label: 'Inventory summary' },
  { key: 'low', label: 'Low stock' },
  { key: 'history', label: 'Movement history' },
  { key: 'in', label: 'Stock in' },
  { key: 'out', label: 'Stock out' },
  { key: 'adjust', label: 'Adjustments' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const REASON: Record<string, string> = { order: 'Order', cancel: 'Cancelled', return: 'Returned', restock: 'Restock', adjust: 'Adjust', edit: 'Order edit' };

type Movement = {
  id: number;
  change: number;
  reason: string;
  note: string | null;
  created_at: string;
  order: { id: string; public_ref: string } | null;
  stock_order: { id: string; ref: string } | null;
  variant: { sku: string; color: string; size: string; image_path: string | null; product: { name: string; images: { storage_path: string; sort_order: number }[] } | null } | null;
};

/** Stock of every product and variation, with photos, totals and the history of every unit in or out. */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase, can }, sp] = await Promise.all([requirePermission('inventory'), searchParams]);
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'summary';
  const withCost = can.has('catalog') || can.has('revenue');
  const isList = tab === 'summary' || tab === 'low';

  const { data: settings } = await supabase.from('store_settings').select('low_stock_threshold').eq('id', 1).single<{ low_stock_threshold: number }>();
  const threshold = settings?.low_stock_threshold ?? 3;

  const [rows, { data: cats }, { count: drafts }] = await Promise.all([
    isList ? loadInventoryRows(supabase, withCost) : Promise.resolve([]),
    isList ? supabase.from('categories').select('id, name').order('name') : Promise.resolve({ data: [] }),
    supabase.from('stock_orders').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
  ]);

  let movements: Movement[] = [];
  const lots = new Map<number, { no: string; qty: number; po: string | null }[]>();
  if (!isList) {
    let mq = supabase
      .from('inventory_movements')
      .select('id, change, reason, note, created_at, order:orders(id, public_ref), stock_order:stock_orders(id, ref), variant:product_variants(sku, color, size, image_path, product:products(name, images:product_images(storage_path, sort_order)))')
      .order('created_at', { ascending: false })
      .limit(200);
    if (tab !== 'history') mq = mq.in('reason', MOVEMENT_REASONS[tab as Exclude<MovementKind, 'all'>]);
    if (tab === 'in') mq = mq.gt('change', 0);
    const { data } = await mq;
    movements = (data ?? []) as unknown as Movement[];
    // Which batch (purchase-order line) each movement took units from or put back into.
    if (movements.length) {
      const { data: lm } = await supabase.from('lot_movements').select('movement_id, qty, lot:stock_lots(lot_no, stock_order_id)').in('movement_id', movements.map((m) => m.id));
      for (const r of (lm ?? []) as unknown as { movement_id: number; qty: number; lot: { lot_no: string; stock_order_id: string | null } | null }[]) {
        if (!r.lot) continue;
        const list = lots.get(r.movement_id) ?? [];
        list.push({ no: r.lot.lot_no, qty: r.qty, po: r.lot.stock_order_id });
        lots.set(r.movement_id, list);
      }
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Warehouse</p>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted">Stock of every product and variation. Every unit in or out is logged.</p>
        </div>
        <Link href="/admin/inventory/stock-orders" className="btn btn-primary btn-sm min-h-10">
          <Icon name="note" size={15} /> Purchase order{drafts ? <span className="rounded-full bg-warn px-1.5 text-[11px] text-white" title="Drafts waiting to be confirmed">{drafts}</span> : null}
        </Link>
      </header>

      <nav aria-label="Inventory views" className="flex gap-1 overflow-x-auto print:hidden">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'summary' ? '/admin/inventory' : `/admin/inventory?tab=${t.key}`} aria-current={t.key === tab ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${t.key === tab ? 'bg-night text-white' : 'bg-white text-ink ring-1 ring-line hover:ring-brand'}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {isList ? (
        <InventoryTable key={tab} rows={rows} threshold={threshold} categories={(cats ?? []) as { id: string; name: string }[]} withCost={withCost} lowOnly={tab === 'low'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-soft text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5 text-right">Change</th>
                <th className="px-3 py-2.5">Reference</th>
                <th className="px-3 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={6} className="py-14 text-center text-muted">Nothing here yet.</td></tr>}
              {movements.map((m) => {
                const img = m.variant?.image_path ?? [...(m.variant?.product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
                return (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px] text-muted">{formatDateTime(m.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2.5">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={img} alt="" sizes="36px" /></span>
                        <span className="min-w-0">
                          <span className="block max-w-[240px] truncate font-semibold">{m.variant?.product?.name ?? 'Deleted product'}</span>
                          <span className="block font-mono text-[11px] text-muted">{m.variant?.sku}{m.variant && [m.variant.color, m.variant.size].filter(Boolean).length ? ` · ${[m.variant.color, m.variant.size].filter(Boolean).join(' / ')}` : ''}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{REASON[m.reason] ?? m.reason}</td>
                    <td className={`px-3 py-2 text-right font-mono text-[13px] font-bold ${m.change > 0 ? 'text-ok' : 'text-bad'}`}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                    <td className="px-3 py-2">
                      {m.order && <Link href={`/admin/orders/${m.order.id}`} className="font-mono text-brand hover:underline">{m.order.public_ref}</Link>}
                      {m.stock_order && <Link href={`/admin/inventory/stock-orders/${m.stock_order.id}`} className="font-mono text-brand hover:underline">{m.stock_order.ref}</Link>}
                      {!m.order && !m.stock_order && !lots.get(m.id) && <span className="text-muted">—</span>}
                      {lots.get(m.id)?.map((l) => (
                        <span key={l.no} className="mt-0.5 block text-[11px] text-muted" title={l.qty < 0 ? 'Taken from this batch' : 'Put back into this batch'}>
                          {l.qty < 0 ? 'from' : 'back to'} {l.po ? <Link href={`/admin/inventory/stock-orders/${l.po}`} className="font-mono font-semibold text-ink hover:text-brand">{l.no}</Link> : <span className="font-mono">{l.no}</span>} ({Math.abs(l.qty)})
                        </span>
                      ))}
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-muted">{m.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {movements.length === 200 && <p className="border-t border-line px-4 py-2 text-[12px] text-muted">The latest 200 are shown.</p>}
        </div>
      )}
    </div>
  );
}
