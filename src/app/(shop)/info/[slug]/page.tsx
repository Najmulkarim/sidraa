import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSettings, getZones } from '@/lib/catalog';
import { formatTaka } from '@/lib/format';
import type { DeliveryZone, StoreSettings } from '@/lib/types';

export const revalidate = 3600;

type Page = { title: string; description: string; body: (s: StoreSettings, zones: DeliveryZone[]) => ReactNode };

/**
 * Starter policy pages built from Settings. They are deliberately plain
 * templates — review them (ideally with a lawyer) before going live.
 */
const PAGES: Record<string, Page> = {
  delivery: {
    title: 'Delivery & cash on delivery',
    description: 'Delivery areas, charges and how cash on delivery works.',
    body: (s, zones) => (
      <>
        <h2>How cash on delivery works</h2>
        <p>{s.cod_terms}</p>
        <ol>
          <li>Place your order — no payment or account needed.</li>
          <li>We call to confirm the order and your address.</li>
          <li>The rider brings the parcel; you check it and pay the rider in cash.</li>
        </ol>
        <h2>Delivery charges</h2>
        {zones.length === 0 ? (
          <p>Delivery areas will be listed here soon.</p>
        ) : (
          <ul>
            {zones.map((z) => (
              <li key={z.id}>
                <strong>{z.name}</strong>: {formatTaka(z.charge)}
                {z.eta_text ? `, usually ${z.eta_text}` : ''}
                {z.free_over !== null ? ` — free on orders of ${formatTaka(z.free_over)} or more` : ''}
              </li>
            ))}
          </ul>
        )}
      </>
    ),
  },
  returns: {
    title: 'Returns',
    description: 'How to return or exchange an item.',
    body: (s) => (
      <>
        <p>
          You can check your parcel in front of the rider before paying. If something is wrong — size, colour or a fault — you may refuse it
          then, or contact us within <strong>{s.return_policy_days} day{s.return_policy_days === 1 ? '' : 's'}</strong> of delivery.
        </p>
        <p>Items must be unused, unwashed and with tags attached. Have your order reference ready when you contact us.</p>
        <p><Link href="/track">Find your order reference</Link></p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    description: 'What we collect and why.',
    body: () => (
      <>
        <p>To deliver your order we collect your name, mobile number, address and any note you add. We do not ask for card details or create customer accounts.</p>
        <p>Your details are used only to confirm and deliver your order and are shared only with the delivery service that carries it.</p>
        <p>Order tracking shows status and items only, never your address or full phone number.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms',
    description: 'Terms of sale.',
    body: (s) => (
      <>
        <p>Prices are in Bangladeshi Taka and include VAT where applicable. The price you pay is the one shown at checkout, confirmed by our server when you place the order.</p>
        <p>Orders are confirmed by phone. We may cancel an order we cannot confirm or if an item becomes unavailable; you will not be charged.</p>
        <p>See our <Link href="/info/returns">returns policy</Link> ({s.return_policy_days} days) and <Link href="/info/delivery">delivery information</Link>.</p>
      </>
    ),
  },
};

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = PAGES[(await params).slug];
  return page ? { title: page.title, description: page.description, alternates: { canonical: `/info/${(await params).slug}` } } : { title: 'Not found' };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  const [settings, zones] = await Promise.all([getSettings(), getZones()]);

  return (
    <article className="container-page max-w-3xl py-12">
      <h1 className="mb-8 font-display text-4xl font-semibold">{page.title}</h1>
      <div className="space-y-4 leading-relaxed text-ink/85 [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1">
        {page.body(settings, zones)}
      </div>
    </article>
  );
}
