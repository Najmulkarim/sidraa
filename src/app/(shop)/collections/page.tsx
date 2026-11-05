import type { Metadata } from 'next';
import Link from 'next/link';
import { getShopTags } from '@/lib/catalog';
import { tagHref } from '@/lib/tags';

export const metadata: Metadata = { title: 'Collections', alternates: { canonical: '/collections' } };

/** Every collection (product tag) with products for sale. */
export default async function CollectionsPage() {
  const tags = await getShopTags();
  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-6 md:mb-8">
        <p className="eyebrow">Shop</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Collections</h1>
      </header>
      {tags.length === 0 ? (
        <p className="card p-8 text-center text-muted">No collections yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link href={tagHref(t.tag)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14px] font-semibold hover:border-brand hover:text-brand">
                {t.tag} <span className="text-[12px] font-normal text-muted">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
