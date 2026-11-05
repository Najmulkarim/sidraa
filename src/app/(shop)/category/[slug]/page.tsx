import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/shop/Listing';
import { getCategories } from '@/lib/catalog';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  if (!category) return { title: 'Not found' };
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name}. Cash on delivery across Bangladesh.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp, categories] = await Promise.all([params, searchParams, getCategories()]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const mother = category.parent_id ? categories.find((c) => c.id === category.parent_id) : undefined;
  const children = categories.filter((c) => c.parent_id === category.id);
  // The chip row stays the same on the mother and on each child, so staff and
  // customers can hop between Hijab, Tops … without going back up.
  const family = mother ?? category;
  const chips = mother ? categories.filter((c) => c.parent_id === mother.id) : children;

  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-5 space-y-1.5 md:mb-8 md:space-y-2">
        <p className="eyebrow">{mother ? <Link href={`/category/${mother.slug}`} className="hover:underline">{mother.name}</Link> : 'Category'}</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{category.name}</h1>
        {category.description && <p className="max-w-2xl text-[14px] text-muted md:text-base">{category.description}</p>}
        {chips.length > 0 && (
          <nav aria-label={`${family.name} categories`} className="flex flex-wrap gap-1.5 pt-2 md:gap-2">
            {[{ id: family.id, slug: family.slug, name: `All ${family.name}` }, ...chips].map((c) => {
              const on = c.id === category.id;
              return on ? (
                <span key={c.id} aria-current="page" className="shrink-0 rounded-full bg-night px-3.5 py-1.5 text-[12.5px] md:px-4 md:text-[13px] font-semibold text-white">{c.name}</span>
              ) : (
                <Link key={c.id} href={`/category/${c.slug}`} scroll={false} className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[12.5px] md:px-4 md:text-[13px] font-medium hover:border-brand hover:text-brand">{c.name}</Link>
              );
            })}
          </nav>
        )}
      </header>
      <Listing basePath={`/category/${category.slug}`} searchParams={sp} category={category} categories={categories} showCategoryFilter={false} hideChips={chips.length > 0} />
    </div>
  );
}
