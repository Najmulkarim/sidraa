import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/shop/Listing';
import { getCategories, getShopTags } from '@/lib/catalog';
import { tagHref, tagsForSlug } from '@/lib/tags';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The tag (and its other spellings) behind /collections/<slug>. */
async function findCollection(slug: string) {
  const all = await getShopTags();
  const tags = tagsForSlug(all.map((t) => t.tag), slug);
  return tags.length ? { name: tags[0]!, tags } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await findCollection((await params).slug);
  if (!c) return { title: 'Not found' };
  return { title: c.name, description: `Shop ${c.name}. Cash on delivery across Bangladesh.`, alternates: { canonical: tagHref(c.name) } };
}

/** A collection: every product for sale with this tag (tags are set on each product in the admin). */
export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp, categories] = await Promise.all([params, searchParams, getCategories()]);
  const c = await findCollection(slug);
  if (!c) notFound();
  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-5 space-y-1.5 md:mb-8 md:space-y-2">
        <p className="eyebrow"><Link href="/collections" className="hover:underline">Collection</Link></p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{c.name}</h1>
      </header>
      <Listing basePath={tagHref(c.name)} searchParams={sp} categories={categories} showCategoryFilter={false} hideChips tags={c.tags} />
    </div>
  );
}
