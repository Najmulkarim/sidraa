import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductImage } from '@/components/shop/ProductImage';
import { requirePermission } from '@/lib/auth';
import { escapeLike } from '@/lib/catalog';
import { formatTaka } from '@/lib/format';
import type { ProductStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Products' };

const PER_PAGE = 30;
const STATUS_TONE: Record<ProductStatus, string> = { published: 'badge-ok', draft: 'badge-low', archived: '' };

type Row = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  base_price: number | string;
  is_featured: boolean;
  category: { name: string } | null;
  images: { storage_path: string; sort_order: number }[];
  variants: { stock: number; is_active: boolean }[];
};

export default async function ProductsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const q = (sp.q ?? '').trim().slice(0, 80);
  const status = ['draft', 'published', 'archived'].includes(sp.status ?? '') ? (sp.status as ProductStatus) : null;
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from('products')
    .select('id, name, slug, status, base_price, is_featured, category:categories(name), images:product_images(storage_path, sort_order), variants:product_variants(stock, is_active)', { count: 'exact' });
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  if (status) query = query.eq('status', status);
  const from = (page - 1) * PER_PAGE;
  const { data, count } = await query.order('updated_at', { ascending: false }).range(from, from + PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted">{count ?? 0} product{count === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/export/products" className="btn btn-outline btn-sm">Download CSV</a>
          <Link href="/admin/products/new" className="btn btn-primary btn-sm">Add product</Link>
        </div>
      </header>

      {sp.deleted && <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Product deleted.</p>}

      <form key={`${q}|${status ?? ''}`} className="card grid gap-3 p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="field">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Product name" className="input" />
        </div>
        <div className="field">
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className="input">
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button className="btn btn-primary">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Status</th><th className="text-right">Price</th><th className="text-right">Stock</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted">No products yet. <Link href="/admin/products/new" className="text-brand underline">Add one</Link>.</td></tr>}
            {rows.map((p) => {
              const stock = p.variants.filter((v) => v.is_active).reduce((n, v) => n + v.stock, 0);
              const img = [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0];
              return (
                <tr key={p.id}>
                  <td className="w-14">
                    <div className="relative h-14 w-11 overflow-hidden rounded-lg"><ProductImage path={img?.storage_path} alt={p.name} sizes="44px" /></div>
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-brand hover:underline">{p.name}</Link>
                    {p.is_featured && <span className="badge badge-brand ml-2">Featured</span>}
                    <div className="text-xs text-muted">/{p.slug}</div>
                  </td>
                  <td>{p.category?.name ?? <span className="text-muted">—</span>}</td>
                  <td><span className={`badge ${STATUS_TONE[p.status]}`}>{p.status}</span></td>
                  <td className="text-right">{formatTaka(p.base_price)}</td>
                  <td className="text-right">
                    <span className={stock === 0 ? 'font-semibold text-bad' : ''}>{stock}</span>
                    <div className="text-xs text-muted">{p.variants.length} variant{p.variants.length === 1 ? '' : 's'}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`} className="btn btn-outline btn-sm">Previous</Link>}
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`} className="btn btn-outline btn-sm">Next</Link>}
        </nav>
      )}
    </div>
  );
}
