import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingRender } from '@/components/shop/landing/LandingRender';
import { visibleImages } from '@/lib/catalog';
import { imageUrl } from '@/lib/env';
import { getLandingPage } from '@/lib/landing-data';
import { plainDescription } from '@/lib/product-content';

export const revalidate = 120;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lp = await getLandingPage(slug);
  if (!lp) return { title: 'Not found' };
  const title = lp.page.headline || lp.product.name;
  const image = imageUrl(visibleImages(lp.product)[0]?.storage_path);
  return {
    title,
    description: lp.page.subheadline || plainDescription(lp.product.description, 160) || undefined,
    // Ad pages: kept out of Google so they do not compete with the product page.
    robots: { index: false },
    alternates: { canonical: `/offer/${slug}` },
    openGraph: { type: 'website', title, url: `/offer/${slug}`, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

/** A one-product sales page for ads: offer, photos, video, points, FAQ and the order form on the page. */
export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const lp = await getLandingPage(slug);
  if (!lp) notFound();
  return <LandingRender page={lp.page} product={lp.product} coupon={lp.coupon} />;
}
