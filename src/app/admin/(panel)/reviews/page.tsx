import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewManager, type AdminReview } from '@/components/admin/ReviewManager';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Reviews' };

const TABS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'hidden', label: 'Hidden' },
] as const;

/** Customer reviews: approve or hide what customers wrote, add reviews they sent by message. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'pending';
  const [{ data, error }, counts, { data: prods }] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id, name, rating, comment, source, status, created_at, product:products(id, name, slug, images:product_images(storage_path, sort_order)), order:orders(public_ref)')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(200),
    Promise.all(TABS.map((t) => supabase.from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', t.key).then((r) => r.count ?? 0))),
    supabase.from('products').select('id, name, sku').neq('status', 'archived').order('name').limit(2000),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted">Customers review products from delivered orders (order number + phone). Approve one and its stars show on the product and every product card.</p>
      </header>
      <nav className="flex gap-1.5" aria-label="Review status">
        {TABS.map((t, i) => (
          <Link key={t.key} href={`/admin/reviews?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === t.key ? 'bg-night text-white' : 'bg-white text-ink/70 ring-1 ring-line hover:text-brand'}`}>
            {t.label} <span className={tab === t.key ? 'text-white/60' : 'text-muted'}>{counts[i]}</span>
          </Link>
        ))}
      </nav>
      {error ? (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load reviews. Run the latest database update (0030) in Supabase, then reload.</p>
      ) : (
        <ReviewManager tab={tab} reviews={(data ?? []) as unknown as AdminReview[]} products={(prods ?? []) as { id: string; name: string; sku: string }[]} />
      )}
    </div>
  );
}
