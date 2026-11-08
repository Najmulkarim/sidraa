import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { LandingDesigns } from '@/components/admin/LandingDesigns';
import { LandingRowActions } from '@/components/admin/LandingRowActions';
import { ProductImage } from '@/components/shop/ProductImage';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Landing pages' };

type Row = {
  id: string; slug: string; is_active: boolean; template: string; headline: string | null; offer_text: string | null; coupon_code: string | null;
  product: { name: string; status: string; images: { storage_path: string; sort_order: number }[] } | null;
};

/** One-product sales pages for ads (/offer/…), with how many orders each brought. */
export default async function LandingPagesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, slug, is_active, template, headline, offer_text, coupon_code, product:products(name, status, images:product_images(storage_path, sort_order))')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const used: Record<string, number> = {};
  for (const r of rows) used[r.template] = (used[r.template] ?? 0) + 1;
  const counts = await Promise.all(
    rows.map((r) => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('landing_slug', r.slug).is('deleted_at', null).then((x) => x.count ?? 0)),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Landing pages</h1>
          <p className="max-w-2xl text-sm text-muted">A one-product page for your Facebook ads: the offer, photos, video, points, questions and the order form on the same page. Orders arrive in Orders as usual.</p>
        </div>
        <Link href="/admin/landing-pages/new" className="btn btn-primary"><Icon name="plus" size={16} /> New landing page</Link>
      </header>

      <LandingDesigns used={used} />

      {rows.length > 0 && <h2 className="text-lg font-bold">Your pages</h2>}
      {sp.created && <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm font-medium text-ok">Landing page created. Copy its link for your ad.</p>}
      {error && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Run the latest database update (0050) in Supabase to use landing pages.</p>}
      {!error && rows.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-semibold">No landing pages yet</p>
          <p className="mt-1 text-sm text-muted">Pick a product, write a headline and a few points, and you get a link like sidraabd.com/offer/eid-abaya.</p>
          <Link href="/admin/landing-pages/new" className="btn btn-primary mt-4">Make the first one</Link>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r, i) => {
            const img = [...(r.product?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <Link href={`/admin/landing-pages/${r.id}`} className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={img} alt="" sizes="48px" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold hover:text-brand">{r.headline || r.product?.name || 'Product deleted'}</span>
                      {!r.is_active && <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">Off</span>}
                      {r.product && r.product.status !== 'published' && <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn">Product {r.product.status}</span>}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {r.product?.name}{r.offer_text ? ` · ${r.offer_text}` : ''}{r.coupon_code ? ` · coupon ${r.coupon_code}` : ''}
                    </span>
                  </span>
                </Link>
                <span className="whitespace-nowrap rounded-full bg-tint px-3 py-1 text-[12px] font-bold text-brand" title="Orders placed from this page">{counts[i]} order{counts[i] === 1 ? "" : "s"}</span>
                <LandingRowActions id={r.id} slug={r.slug} active={r.is_active} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
