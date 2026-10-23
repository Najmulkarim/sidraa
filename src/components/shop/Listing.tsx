import Link from 'next/link';
import { listProducts, SORTS, type ListParams } from '@/lib/catalog';
import type { Category } from '@/lib/types';
import { ProductGrid } from './ProductCard';

type Search = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readListParams(sp: Search): Omit<ListParams, 'category'> {
  const sort = first(sp.sort);
  return {
    q: first(sp.q)?.slice(0, 80),
    sort: sort && sort in SORTS ? (sort as ListParams['sort']) : 'new',
    inStock: first(sp.stock) === '1',
    page: Number(first(sp.page)) || 1,
  };
}

function pageHref(basePath: string, sp: Search, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v);
    if (val && k !== 'page') params.set(k, val);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Product listing with search, sort, in-stock filter and pagination. The
 * filter form is a plain GET form, so it works without JavaScript.
 */
export async function Listing({
  basePath,
  searchParams,
  category,
  categories,
  showCategoryFilter,
}: {
  basePath: string;
  searchParams: Search;
  category?: Category;
  categories: Category[];
  showCategoryFilter: boolean;
}) {
  const params = readListParams(searchParams);
  const categoryFilter = category?.id ?? categories.find((c) => c.slug === first(searchParams.category))?.id;
  const { products, total, page, pages } = await listProducts({ ...params, category: categoryFilter });

  return (
    <div className="space-y-8">
      <form key={JSON.stringify(searchParams)} action={basePath} className="card grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={params.q ?? ''} placeholder="Search products" maxLength={80} className="input" />
        {showCategoryFilter && (
          <>
            <label className="sr-only" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={first(searchParams.category) ?? ''} className="input sm:w-44">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="sort">Sort</label>
        <select id="sort" name="sort" defaultValue={params.sort} className="input sm:w-48">
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 px-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={params.inStock} className="h-4 w-4 accent-[var(--brand)]" />
          In stock only
        </label>
        <button className="btn btn-primary">Apply</button>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {total === 0 ? 'No products match.' : `${total} product${total === 1 ? '' : 's'}`}
        {params.q ? ` for “${params.q}”` : ''}
      </p>

      {products.length > 0 ? (
        <ProductGrid products={products} priorityCount={4} />
      ) : (
        <div className="card p-10 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted">Try another search or clear the filters.</p>
          <Link href={basePath} className="btn btn-outline mt-5">Clear filters</Link>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(basePath, searchParams, page - 1)} className="btn btn-outline btn-sm" rel="prev">Previous</Link>
          ) : (
            <span className="btn btn-outline btn-sm" aria-disabled="true">Previous</span>
          )}
          <span className="px-3 text-sm text-muted">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={pageHref(basePath, searchParams, page + 1)} className="btn btn-outline btn-sm" rel="next">Next</Link>
          ) : (
            <span className="btn btn-outline btn-sm" aria-disabled="true">Next</span>
          )}
        </nav>
      )}
    </div>
  );
}
