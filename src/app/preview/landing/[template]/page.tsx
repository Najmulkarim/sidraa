import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LandingRender } from '@/components/shop/landing/LandingRender';
import { requirePermission } from '@/lib/auth';
import { getProductBySlug } from '@/lib/catalog';
import { parseDescription, plainDescription } from '@/lib/product-content';
import { LANDING_TEMPLATES, parseShowcase, showcaseFromProduct, type LandingTemplate } from '@/lib/showcase';
import { createPublicClient } from '@/lib/supabase/public';
import type { LandingPage } from '@/lib/landing';
import { parseStory, storagePath, storyFromProduct } from '@/lib/story';

export const metadata: Metadata = { title: 'Design preview', robots: { index: false, follow: false } };

const NAMES: Record<LandingTemplate, string> = { showcase: 'Showcase', classic: 'Simple', story: 'Story' };

/**
 * Staff-only preview of a landing page design, filled with one of the shop's own
 * products (the newest with the most photos). No order form, no Pixel.
 * ?embed=1: the small live picture on the Landing pages list.
 */
export default async function LandingDesignPreview({ params, searchParams }: { params: Promise<{ template: string }>; searchParams: Promise<{ embed?: string }> }) {
  const [{ template }, { embed }] = await Promise.all([params, searchParams, requirePermission('catalog')]);
  if (!(LANDING_TEMPLATES as readonly string[]).includes(template)) notFound();
  const t = template as LandingTemplate;

  const { data } = await createPublicClient().from('products').select('slug, images:product_images(id)').order('created_at', { ascending: false }).limit(40);
  const pick = ((data ?? []) as { slug: string; images: { id: string }[] }[]).sort((a, b) => b.images.length - a.images.length)[0];
  const product = pick ? await getProductBySlug(pick.slug) : null;
  if (!product) return <p className="p-10 text-center text-muted">Add a product with photos to see this design.</p>;

  const content = parseDescription(product.description);
  const first = content.flow.find((f) => f.type === 'p');
  const photos = [...product.images].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.storage_path);
  const page: LandingPage = {
    id: 'demo', slug: 'demo', product_id: product.id, is_active: true,
    headline: product.name,
    subheadline: plainDescription(first && first.type === 'p' ? first.text : '', 300) || null,
    offer_text: 'Your offer line here', coupon_code: null, video_url: null,
    benefits: content.bullets.slice(0, 6), faqs: [{ q: 'Your questions and answers show here', a: 'For example delivery time, sizes and how to pay.' }],
    button_text: null, show_description: true, show_reviews: true, template: t,
    story: t === 'story' ? storyFromProduct({ name: product.name, intro: plainDescription(first && first.type === 'p' ? first.text : '', 600), bullets: content.bullets.slice(0, 13), posters: content.blocks.flatMap((b) => (b.type === 'img' ? [storagePath(b.src)].filter((x): x is string => !!x) : [])).slice(0, 12), photos }) : parseStory({}),
    sections: t === 'showcase' ? showcaseFromProduct({ name: product.name, photos, bullets: content.bullets.slice(0, 13), intro: plainDescription(first && first.type === 'p' ? first.text : '', 300) }) : parseShowcase({}),
  };

  return (
    <>
      {embed ? <base target="_blank" /> : (
        <div className="sticky top-0 z-40 bg-night text-white">
          <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-[13px]">
            <span>Preview of the <b>{NAMES[t]}</b> design with your product “{product.name}”. Every word and photo can be changed.</span>
            <span className="flex gap-3">
              <Link href={`/admin/landing-pages/new?template=${t}`} className="rounded-full bg-brand px-3 py-1 font-semibold text-white">Use this design</Link>
              <Link href="/admin/landing-pages" className="font-semibold text-accent underline">Back</Link>
            </span>
          </p>
        </div>
      )}
      <LandingRender page={page} product={product} coupon={null} demo />
    </>
  );
}
