import type { Metadata } from 'next';
import Link from 'next/link';
import { AdjustStockForm } from '@/components/admin/AdjustStockForm';
import { requirePermission } from '@/lib/auth';
import { escapeLike, variantLabel } from '@/lib/catalog';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Inventory' };

type VariantRow = {
  id: string;
  sku: string;
  size: string;
  color: string;
  option3: string;
  stock: number;
  is_active: boolean;
  product: { id: string; name: string; status: string } | null;
};
type Movement = {
  id: number;
  change: number;
  reason: string;
  note: string | null;
  created_at: string;
  order: { id: string; public_ref: string } | null;
  variant: { sku: string; product: { name: string } | null } | null;
};

const REASON: Record<string, string> = { order: 'Order', cancel: 'Cancelled', return: 'Returned', restock: 'Restock', adjust: 'Adjust' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('inventory'), searchParams]);
  const q = (sp.q ?? '').trim().slice(0, 64);
  const low = sp.low === '1';
  const selectedId = sp.variant && /^[0-9a-f-]{36}$/i.test(sp.variant) ? sp.variant : null;

  const { data: settings } = await supabase.from('store_settings').select('low_stock_threshold').eq('id', 1).single<{ low_stock_threshold: number }>();
  const threshold = settings?.low_stock_threshold ?? 3;

  let query = supabase
    .from('product_variants')
    .select('id, sku, size, color, option3, stock, is_active, product:products!inner(id, name, status)')
    .neq('product.status', 'archived');
  if (q) query = query.ilike('sku', `%${escapeLike(q)}%`);
  if (low) query = query.lte('stock', threshold).eq('is_active', true);
  const { data: vData } = await query.order('stock').order('sku').limit(200);
  const variants = (vData ?? []) as unknown as VariantRow[];

  let selected: VariantRow | null = null;
  if (selectedId) {
    const { data } = await supabase
      .from('product_variants')
      .select('id, sku, size, color, option3, stock, is_active, product:products(id, name, status)')
      .eq('id', selectedId)
      .maybeSingle();
    selected = (data as unknown as VariantRow | null) ?? null;
  }

  let mq = supabase
    .from('inventory_movements')
    .select('id, change, reason, note, created_at, order:orders(id, public_ref), variant:product_variants(sku, product:products(name))')
    .order('created_at', { ascending: false })
    .limit(50);
  if (selectedId) mq = mq.eq('variant_id', selectedId);
  const { data: mData } = await mq;
  const movements = (mData ?? []) as unknown as Movement[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted">Every unit in or out is logged: orders, cancellations, returns, restocks and manual adjustments.</p>
      </header>

      {selected && (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              {selected.product?.name} <span className="font-normal text-muted">· {variantLabel(selected) || 'Default'} · <span className="font-mono">{selected.sku}</span></span>
            </h2>
            <Link href="/admin/inventory" className="text-sm text-muted underline">Close</Link>
          </div>
          <AdjustStockForm key={selected.id} variantId={selected.id} current={selected.stock} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="card overflow-hidden">
          <form key={`${q}|${low}`} className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <div className="field flex-1">
              <label htmlFor="q" className="label">SKU</label>
              <input id="q" name="q" defaultValue={q} placeholder="Search SKU" className="input" />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="low" value="1" defaultChecked={low} className="h-4 w-4 accent-[var(--brand)]" />
              Low stock only (≤ {threshold})
            </label>
            <button className="btn btn-primary btn-sm">Filter</button>
          </form>
          <div className="max-h-[70dvh] overflow-auto">
            <table className="table">
              <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Stock</th><th></th></tr></thead>
              <tbody>
                {variants.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">Nothing found.</td></tr>}
                {variants.map((v) => (
                  <tr key={v.id} className={v.id === selectedId ? 'bg-brand/5' : ''}>
                    <td>
                      <div className="font-medium">{v.product?.name}</div>
                      <div className="text-xs text-muted">{variantLabel(v) || 'Default'}{!v.is_active ? ' · hidden' : ''}</div>
                    </td>
                    <td className="font-mono text-xs">{v.sku}</td>
                    <td className={`text-right font-semibold ${v.stock === 0 ? 'text-bad' : v.stock <= threshold ? 'text-warn' : ''}`}>{v.stock}</td>
                    <td className="text-right"><Link href={`/admin/inventory?variant=${v.id}${q ? `&q=${encodeURIComponent(q)}` : ''}${low ? '&low=1' : ''}`} className="btn btn-ghost btn-sm">Adjust</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-line p-4 font-semibold">{selected ? 'History for this variant' : 'Latest stock movements'}</h2>
          <ul className="max-h-[70dvh] divide-y divide-line overflow-auto text-sm">
            {movements.length === 0 && <li className="p-4 text-muted">No movements yet.</li>}
            {movements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div>
                  <p>
                    <span className="font-medium">{REASON[m.reason] ?? m.reason}</span>
                    {!selected && m.variant && <span className="text-muted"> · {m.variant.product?.name} ({m.variant.sku})</span>}
                    {m.order && <> · <Link href={`/admin/orders/${m.order.id}`} className="font-mono text-brand">{m.order.public_ref}</Link></>}
                  </p>
                  {m.note && <p className="text-muted">{m.note}</p>}
                  <p className="text-xs text-muted">{formatDateTime(m.created_at)}</p>
                </div>
                <span className={`font-mono font-semibold ${m.change > 0 ? 'text-ok' : 'text-bad'}`}>{m.change > 0 ? `+${m.change}` : m.change}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
