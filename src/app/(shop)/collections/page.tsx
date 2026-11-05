import type { Metadata } from 'next';
import Link from 'next/link';
import { getCollections, getShopTags } from '@/lib/catalog';
import { tagHref } from '@/lib/tags';

export const metadata: Metadata = { title: 'Collections', alternates: { canonical: '/collections' } };

/** Every collection made in the admin, then product tags (each one is a collection too). */
export default async function CollectionsPage() {
  const [collections, tags] = await Promise.all([getCollections(), getShopTags()]);
  const chip = 'inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14px] font-semibold hover:border-brand hover:text-brand';
  return (
    <div className="container-page space-y-8 py-6 md:py-10">
      <header>
        <p className="eyebrow">Shop</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Collections</h1>
      </header>
      {collections.length === 0 && tags.length === 0 && <p className="card p-8 text-center text-muted">No collections yet.</p>}
      {collections.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.slug}`} className="card block h-full p-5 transition hover:border-brand">
                <span className="block text-lg font-bold">{c.name}</span>
                {c.description && <span className="mt-1 line-clamp-2 block text-[13.5px] text-muted">{c.description}</span>}
                <span className="mt-2 inline-block text-[13px] font-semibold text-brand">Shop now →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tags.length > 0 && (
        <section className="space-y-3">
          {collections.length > 0 && <h2 className="text-lg font-bold">Browse by tag</h2>}
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.tag}><Link href={tagHref(t.tag)} className={chip}>{t.tag} <span className="text-[12px] font-normal text-muted">{t.count}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
