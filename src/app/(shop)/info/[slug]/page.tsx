import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSettings, getZones } from '@/lib/catalog';
import { descriptionToHtml } from '@/lib/description-html';
import { defaultPageText, INFO_PAGE_KEYS, INFO_PAGES, isInfoPage, zoneLine } from '@/lib/info-pages';
import { parseStorefront } from '@/lib/storefront';

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return INFO_PAGE_KEYS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isInfoPage(slug)) return { title: 'Not found' };
  const own = parseStorefront((await getSettings()).storefront).pages[slug];
  return { title: own.title || INFO_PAGES[slug].title, description: INFO_PAGES[slug].description, alternates: { canonical: `/info/${slug}` } };
}

/** Delivery, returns, privacy and terms: the text written in Admin → Pages, or the starter text. */
export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  if (!isInfoPage(slug)) notFound();
  const [settings, zones] = await Promise.all([getSettings(), getZones()]);
  const own = parseStorefront(settings.storefront).pages[slug];
  let text = own.body || defaultPageText(slug, settings);
  if (slug === 'delivery') {
    const active = zones.filter((z) => z.is_active !== false);
    text += `\n\n## Delivery charges\n${active.length ? active.map((z) => `- ${zoneLine(z)}`).join('\n') : 'Delivery areas will be listed here soon.'}`;
  }

  return (
    <article className="container-page max-w-3xl py-12">
      <h1 className="mb-8 font-display text-4xl font-semibold">{own.title || INFO_PAGES[slug].title}</h1>
      {/* descriptionToHtml escapes the text and only adds headings, lists, bold and pictures. */}
      <div className="rte info-page text-ink/85" dangerouslySetInnerHTML={{ __html: descriptionToHtml(text) }} />
    </article>
  );
}
