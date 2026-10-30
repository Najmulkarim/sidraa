import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { CopySku, PerPageSelect, ProductCardControls } from '@/components/admin/ProductListControls';
import { ProductImage } from '@/components/shop/ProductImage';
import { ImportProductButton } from '@/components/admin/ImportProductButton';
import { RefreshCatalogButton } from '@/components/admin/RefreshCatalogButton';
import { requirePermission } from '@/lib/auth';
import { escapeLike } from '@/lib/catalog';
import { formatTaka, toNumber } from '@/lib/format';
import type { ProductStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Products' };

const PER_PAGE_OPTIONS = [12, 24, 48, 96];
const DEFAULT_PER_PAGE = 24;
// Off for now; turn on to bring back the Import button (the code is kept).
const SHOW_IMPORT = false;
const STATUS_DOT: Record<ProductStatus, string> = { published: 'bg-ok', draft: 'bg-warn', archived: 'bg-muted' };
const STATUS_FILTERS: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

type Row = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: ProductStatus;
  base_price: number | string;
  compare_at_price: number | string | null;
  is_featured: boolean;
  category: { name: string } | null;
  images: { storage_path: string; sort_order: number }[];
  variants: { sku: string; stock: number; is_active: boolean; price: number | string | null }[];
};

/** Page numbers around the current one, with gaps: 1 … 4 5 [6] 7 8 … 21 */
function pageList(page: number, pages: number): (number | '…')[] {
  const out: (number | '…')[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) out.push(n);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

export default async function ProductsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase, can }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const q = (sp.q ?? '').trim().slice(0, 80);
  const status = ['draft', 'published', 'archived'].includes(sp.status ?? '') ? (sp.status as ProductStatus) : null;
  const per = PER_PAGE_OPTIONS.includes(Number(sp.per)) ? Number(sp.per) : DEFAULT_PER_PAGE;
  const page = Math.max(1, Number(sp.page) || 1);

  // Search matches the product name, the product SKU or any variation SKU.
  const like = `%${escapeLike(q)}%`;
  let skuProductIds: string[] = [];
  if (q) {
    const { data: bySku } = await supabase.from('product_variants').select('product_id').ilike('sku', like).limit(300);
    skuProductIds = [...new Set(((bySku ?? []) as { product_id: string }[]).map((r) => r.product_id))];
  }

  let query = supabase
    .from('products')
    .select('id, sku, name, slug, status, base_price, compare_at_price, is_featured, category:categories(name), images:product_images(storage_path, sort_order), variants:product_variants(sku, stock, is_active, price)', { count: 'exact' });
  if (q) {
    // Inside or() the value is double-quoted so commas and brackets in the search stay literal.
    const quoted = `"${like.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    query = query.or(`name.ilike.${quoted},sku.ilike.${quoted}${skuProductIds.length ? `,id.in.(${skuProductIds.join(',')})` : ''}`);
  }
  if (status) query = query.eq('status', status);
  const from = (page - 1) * per;
  const [{ data, count }, { count: total }] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, from + per - 1),
    supabase.from('products').select('id', { count: 'exact', head: true }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const found = count ?? 0;
  const pages = Math.max(1, Math.ceil(found / per));

  const href = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const merged = { q: q || null, status, per: per === DEFAULT_PER_PAGE ? null : per, page: null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== null && v !== '' && !(k === 'page' && v === 1)) next.set(k, String(v));
    const s = next.toString();
    return s ? `/admin/products?${s}` : '/admin/products';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Products</h1>
          <p className="text-sm text-muted">Manage your store&apos;s product catalog</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-ok/10 px-3 py-1 text-[12px] font-semibold text-ok">
          <span className="h-2 w-2 rounded-full bg-ok" /> {total ?? 0} Products
        </span>
      </header>

      {sp.deleted && <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Product deleted.</p>}

      <section className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <form key={q} action="/admin/products" className="flex min-w-0 flex-1 overflow-hidden rounded-xl border-[1.5px] border-line focus-within:border-brand">
            {status && <input type="hidden" name="status" value={status} />}
            {per !== DEFAULT_PER_PAGE && <input type="hidden" name="per" value={per} />}
            <label htmlFor="q" className="grid w-11 place-items-center text-muted"><Icon name="search" size={18} /><span className="sr-only">Search</span></label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name or SKU" maxLength={80} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-[15px] outline-none sm:text-sm" />
            <Link href={href({ q: null, status: null })} className="grid place-items-center bg-[linear-gradient(105deg,var(--brand),var(--plum))] px-4 text-[12.5px] font-semibold text-white">
              All Results
            </Link>
          </form>
          <div className="flex gap-2">
            <a href="/admin/export/products" className="btn btn-outline btn-sm h-11">CSV</a>
            {SHOW_IMPORT && <ImportProductButton />}
            {can.has('marketing') && <RefreshCatalogButton />}
            <Link href="/admin/products/new" className="btn btn-primary btn-sm h-11 flex-1 sm:flex-none"><Icon name="plus" size={16} /> Add Product</Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-muted">
            Searches published &amp; unpublished products. Press <kbd className="rounded border border-line bg-soft px-1">Enter</kbd> or click <b>All Results</b> for the full list.
          </p>
          <nav aria-label="Filter by status" className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.label}
                href={href({ status: f.value || null })}
                aria-current={(status ?? '') === f.value ? 'page' : undefined}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${(status ?? '') === f.value ? 'bg-tint text-brand' : 'text-muted hover:bg-soft'}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          Showing <b className="text-ink">{rows.length}</b> of <b className="text-ink">{found}</b> products · Page <b className="text-ink">{Math.min(page, pages)}</b> of <b className="text-ink">{pages}</b>
          {q && <> for &ldquo;{q}&rdquo;</>}
        </p>
        <PerPageSelect value={per} options={PER_PAGE_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <div className="card py-16 text-center text-muted">
          {q || status ? <>No products match. <Link href="/admin/products" className="text-brand underline">Show all</Link></> : <>No products yet. <Link href="/admin/products/new" className="text-brand underline">Add one</Link>.</>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rows.map((p) => {
            const active = p.variants.filter((v) => v.is_active);
            const stock = active.reduce((n, v) => n + v.stock, 0);
            const prices = active.map((v) => toNumber(v.price ?? p.base_price));
            const price = prices.length ? Math.min(...prices) : toNumber(p.base_price);
            const compare = p.compare_at_price === null ? null : toNumber(p.compare_at_price);
            const img = [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0];
            const sku = p.sku;
            return (
              <li key={p.id} className="card flex flex-col overflow-hidden transition hover:shadow-[var(--shadow)]">
                <Link href={`/admin/products/${p.id}`} className="relative block aspect-square overflow-hidden bg-soft">
                  <ProductImage path={img?.storage_path} alt={p.name} sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 48vw" />
                  <span title={p.status} className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white ${STATUS_DOT[p.status]}`} />
                  {p.is_featured && <span className="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">Featured</span>}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <h2 className={`line-clamp-2 min-h-[2.5em] text-[12.5px] font-semibold leading-tight ${p.status === 'published' ? '' : 'text-muted'}`}>
                    <Link href={`/admin/products/${p.id}`} className="hover:text-brand">{p.name}</Link>
                  </h2>
                  {sku ? (
                    <p className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
                      SKU: <span className="truncate font-semibold text-brand" title={`${sku} · ${p.variants.length} variation${p.variants.length === 1 ? '' : 's'}`}>{sku}</span>
                      <CopySku sku={sku} />
                      {p.variants.length > 1 && <span className="shrink-0">· {p.variants.length} var.</span>}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted">No SKU yet</p>
                  )}
                  <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-0.5">
                    <span className="text-[15px] font-bold">{formatTaka(price)}</span>
                    {compare !== null && compare > price && <s className="text-[11px] text-muted">{formatTaka(compare)}</s>}
                  </p>
                  <p className="flex items-center justify-between gap-1">
                    <span className={`badge !px-2 !text-[10px] ${stock === 0 ? 'badge-bad' : stock <= 3 ? 'badge-low' : 'badge-ok'}`}>{stock === 0 ? 'Out of stock' : `${stock} in stock`}</span>
                    {p.category && <span className="truncate text-[10.5px] text-muted">{p.category.name}</span>}
                  </p>
                </div>
                <ProductCardControls id={p.id} name={p.name} published={p.status === 'published'} featured={p.is_featured} archived={p.status === 'archived'} />
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
          {page > 1 && <Link href={href({ page: page - 1 })} className="btn btn-outline btn-sm">Prev</Link>}
          {pageList(page, pages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-muted">…</span>
            ) : (
              <Link
                key={n}
                href={href({ page: n })}
                aria-current={n === page ? 'page' : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-[13px] font-semibold ${n === page ? 'bg-brand text-white' : 'border border-line hover:border-brand hover:text-brand'}`}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages && <Link href={href({ page: page + 1 })} className="btn btn-outline btn-sm">Next</Link>}
        </nav>
      )}
    </div>
  );
}
