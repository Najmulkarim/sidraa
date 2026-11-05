import Link from 'next/link';
import { getShopCategories, listProducts, SORTS, type ListParams } from '@/lib/catalog';
import type { Category } from '@/lib/types';
import { ListingFilters } from './ListingFilters';
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
 * Product listing with sort, in-stock filter and pagination (search comes from
 * the header). The filters are a GET form, so they work without JavaScript too.
 */
export async function Listing({
  basePath,
  searchParams,
  category,
  categories,
  showCategoryFilter,
  hideChips = false,
}: {
  basePath: string;
  searchParams: Search;
  category?: Category;
  categories: Category[];
  showCategoryFilter: boolean;
  /** A category page with its own child chips: skip the all-categories row on phones. */
  hideChips?: boolean;
}) {
  const params = readListParams(searchParams);
  const categoryFilter = category?.id ?? categories.find((c) => c.slug === first(searchParams.category))?.id;
  const [{ products, total, page, pages }, chips] = await Promise.all([listProducts({ ...params, category: categoryFilter }), getShopCategories()]);
  const currentSlug = category?.slug ?? first(searchParams.category) ?? null;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Phones: swipeable category chips, like a shopping app. */}
      {chips.length > 1 && !hideChips && (
        <nav aria-label="Categories" className="flex flex-wrap gap-1.5 md:hidden">
          {[{ slug: null as string | null, name: 'All', href: '/products' }, ...chips.map((c) => ({ slug: c.slug as string | null, name: c.name, href: `/category/${c.slug}` }))].map((c) => {
            const on = c.slug === currentSlug;
            return (
              <Link key={c.href} href={c.href} aria-current={on ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition active:scale-95 ${on ? 'bg-night text-white' : 'bg-card text-ink ring-1 ring-line'}`}>
                {c.name}
              </Link>
            );
          })}
        </nav>
      )}

      <ListingFilters
        key={JSON.stringify(searchParams)}
        basePath={basePath}
        total={total}
        q={params.q ?? null}
        sort={params.sort ?? 'new'}
        inStock={params.inStock ?? false}
        sorts={SORTS}
        categories={showCategoryFilter ? categories.map((c) => ({ slug: c.slug, name: c.name })) : undefined}
        category={first(searchParams.category) ?? null}
        clearHref={pageHref(basePath, Object.fromEntries(Object.entries(searchParams).filter(([k]) => k !== 'q')), 1)}
      />

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
