import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/shop/Listing';
import { filterForCollection, getCategories, getCollections, getShopTags } from '@/lib/catalog';
import { tagHref, tagsForSlug } from '@/lib/tags';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * /collections/<slug>: a collection made in Admin › Collections, or else a
 * product tag (every tag works as a simple collection too).
 */
async function findCollection(slug: string) {
  const made = (await getCollections()).find((c) => c.slug === decodeURIComponent(slug));
  if (made) return { name: made.name, description: made.description, href: `/collections/${made.slug}`, filter: (await filterForCollection(made)) ?? 'id.is.null', tags: undefined };
  const tags = tagsForSlug((await getShopTags()).map((t) => t.tag), slug);
  return tags.length ? { name: tags[0]!, description: null, href: tagHref(tags[0]!), filter: undefined, tags } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await findCollection((await params).slug);
  if (!c) return { title: 'Not found' };
  return { title: c.name, description: c.description ?? `Shop ${c.name}. Cash on delivery across Bangladesh.`, alternates: { canonical: c.href } };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp, categories] = await Promise.all([params, searchParams, getCategories()]);
  const c = await findCollection(slug);
  if (!c) notFound();
  return (
    <div className="container-page py-6 md:py-10">
      {/* No visible heading (the products start at once); search engines still read the name. */}
      <h1 className="sr-only">{c.name}</h1>
      <Listing basePath={c.href} searchParams={sp} categories={categories} showCategoryFilter={false} hideChips tags={c.tags} filter={c.filter} />
    </div>
  );
}
