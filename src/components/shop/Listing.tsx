import Link from 'next/link';
import { getShopCategories, listProducts, SORTS, type ListParams } from '@/lib/catalog';
import { Icon } from '../icons';
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
  const [{ products, total, page, pages }, chips] = await Promise.all([listProducts({ ...params, category: categoryFilter }), getShopCategories()]);
  const currentSlug = category?.slug ?? first(searchParams.category) ?? null;
  // Phones fold sort / stock / category behind a Filter button; open it when one is in use.
  const filtering = params.inStock || params.sort !== 'new' || (showCategoryFilter && !!first(searchParams.category));

  return (
    <div className="space-y-8">
      {/* Phones: swipeable category chips, like a shopping app. */}
      {chips.length > 1 && (
        <nav aria-label="Categories" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          {[{ slug: null as string | null, name: 'All', href: '/products' }, ...chips.map((c) => ({ slug: c.slug as string | null, name: c.name, href: `/category/${c.slug}` }))].map((c) => {
            const on = c.slug === currentSlug;
            return (
              <Link key={c.href} href={c.href} aria-current={on ? 'page' : undefined} className={`shrink-0 snap-start rounded-full px-4 py-2 text-[13px] font-semibold transition active:scale-95 ${on ? 'bg-night text-white' : 'bg-card text-ink ring-1 ring-line'}`}>
                {c.name}
              </Link>
            );
          })}
        </nav>
      )}

      <form key={JSON.stringify(searchParams)} action={basePath} className="card p-3 md:flex md:items-center md:gap-3">
        <div className="flex gap-2 md:flex-1">
          <label className="sr-only" htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={params.q ?? ''} placeholder="Search products" maxLength={80} className="input min-w-0 flex-1" />
          <label htmlFor="filters-open" className="btn btn-outline shrink-0 cursor-pointer px-3 md:hidden" aria-label="Filter and sort">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </label>
          <button className="btn btn-primary shrink-0 px-3 md:hidden" aria-label="Search"><Icon name="search" size={18} /></button>
        </div>
        <input id="filters-open" type="checkbox" defaultChecked={filtering} className="peer sr-only" />
        <div className="mt-3 hidden gap-3 peer-checked:grid md:mt-0 md:flex md:items-center">
        {showCategoryFilter && (
          <>
            <label className="sr-only" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={first(searchParams.category) ?? ''} className="input hidden md:block md:w-44">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="sort">Sort</label>
        <select id="sort" name="sort" defaultValue={params.sort} className="input md:w-48">
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 px-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={params.inStock} className="h-4 w-4 accent-[var(--brand)]" />
          In stock only
        </label>
        <button className="btn btn-primary">Apply</button>
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {total === 0 ? 'No products match.' : `${total} product${total === 1 ? '' : 's'}`}
        {params.q ? ` for “${params.q}”` : ''}
      </p>

      {products.length > 0 ? (
        <section aria-labelledby="listing-heading">
          <h2 id="listing-heading" className="sr-only">Products</h2>
          <ProductGrid products={products} priorityCount={4} />
        </section>
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
