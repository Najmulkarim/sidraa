import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import './globals.css';

// Premium pairing: Cormorant Garamond (high-contrast serif) for display headings, Jost (clean geometric sans) for everything else.
const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-heading', display: 'swap' });
const body = Jost({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.tagline ?? `Shop ${s.store_name} online. Cash on delivery across Bangladesh.`;
  return {
    metadataBase: new URL(SITE_URL),
    icons: { icon: '/brand/favicon.png' },
    title: { default: s.store_name, template: `%s · ${s.store_name}` },
    description,
    openGraph: { siteName: s.store_name, type: 'website', locale: 'en_BD' },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  // Only well-formed hex colours reach the style attribute.
  const style = {
    ...(HEX.test(s.theme.primary ?? '') ? { '--brand': s.theme.primary } : {}),
    ...(HEX.test(s.theme.accent ?? '') ? { '--accent': s.theme.accent } : {}),
  } as CSSProperties;

  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`} style={style}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
