'use client';

import Form from 'next/form';
import Link from 'next/link';

/**
 * One slim row above the products: how many there are, then "In stock" and the
 * sort order, which apply as soon as they change (no Apply button). The search
 * box lives in the header, so a search in use shows here as a chip to clear.
 */
export function ListingFilters({ basePath, total, q, sort, inStock, sorts, categories, category, clearHref }: {
  basePath: string; total: number; q: string | null; sort: string; inStock: boolean;
  sorts: Record<string, string>; categories?: { slug: string; name: string }[]; category?: string | null; clearHref: string;
}) {
  return (
    <Form action={basePath} scroll={false} replace onChange={(e) => e.currentTarget.requestSubmit()} className="flex flex-wrap items-center gap-1.5 border-b md:gap-2 border-line pb-3">
      {q && <input type="hidden" name="q" value={q} />}
      <p className="mr-auto flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted" aria-live="polite">
        <span><b className="font-semibold text-ink">{total}</b> product{total === 1 ? '' : 's'}</span>
        {q && (
          <Link href={clearHref} scroll={false} className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-[12px] font-semibold text-brand" title="Clear the search">
            <span className="truncate">“{q}”</span><span aria-hidden>×</span>
          </Link>
        )}
      </p>
      {categories && (
        <select name="category" defaultValue={category ?? ''} aria-label="Category" className="input hidden h-10 w-44 py-0 text-[13px] md:block">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      )}
      <label className="cursor-pointer">
        <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="peer sr-only" />
        <span className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12.5px] md:h-10 md:gap-1.5 md:px-3.5 md:text-[13px] font-medium transition peer-checked:border-night peer-checked:bg-night peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
          In stock
        </span>
      </label>
      <label className="relative">
        <span className="sr-only">Sort</span>
        <select name="sort" defaultValue={sort} className="h-9 cursor-pointer appearance-none rounded-full border border-line bg-white py-0 pl-3 pr-7 text-[12.5px] md:h-10 md:pl-3.5 md:pr-8 md:text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {Object.entries(sorts).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </label>
      <noscript><button className="btn btn-primary btn-sm">Apply</button></noscript>
    </Form>
  );
}
