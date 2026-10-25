import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Cormorant_Garamond, Inter, Jost, Playfair_Display, Plus_Jakarta_Sans, Poppins } from 'next/font/google';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import { isTheme } from '@/lib/home-sections';
import { imageUrl } from '@/lib/env';
import { parseStorefront } from '@/lib/storefront';
import './globals.css';

// One pair per home theme (globals.css maps [data-theme] to them). Not preloaded:
// the browser only downloads the faces the live theme actually uses.
const cormorant = Cormorant_Garamond({ subsets: ['latin'], display: 'swap', preload: false, weight: ['500', '600', '700'], variable: '--f-cormorant' });
const jost = Jost({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700'], variable: '--f-jost' });
const poppins = Poppins({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700', '800'], variable: '--f-poppins' });
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, weight: ['500', '600', '700'], variable: '--f-playfair' });
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700'], variable: '--f-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700', '800'], variable: '--f-jakarta' });
const fontVars = [cormorant, jost, poppins, playfair, inter, jakarta].map((f) => f.variable).join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.tagline ?? `Shop ${s.store_name} online. Cash on delivery across Bangladesh.`;
  const sf = parseStorefront(s.storefront);
  const favicon = imageUrl(sf.favicon);
  const og = imageUrl(sf.og_image);
  const title = sf.site_title || s.store_name;
  return {
    metadataBase: new URL(SITE_URL),
    icons: { icon: favicon ?? '/brand/favicon.png', apple: favicon ?? '/brand/apple-icon.png' },
    // "Add to Home Screen" opens the shop full-screen, like an app.
    appleWebApp: { capable: true, title: s.store_name, statusBarStyle: 'default' },
    title: { default: title, template: `%s · ${s.store_name}` },
    description,
    openGraph: { siteName: s.store_name, type: 'website', locale: 'en_BD', ...(og ? { images: [{ url: og }] } : {}) },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  viewportFit: 'cover',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  const sf = parseStorefront(s.storefront);
  // Only well-formed hex colours reach the style attribute.
  const style = {
    ...(HEX.test(s.theme.primary ?? '') ? { '--brand': s.theme.primary } : {}),
    ...(HEX.test(s.theme.accent ?? '') ? { '--accent': s.theme.accent } : {}),
    // Settings → Storefront fonts override the theme's pair.
    ...(sf.font_heading ? { '--font-heading': `var(--f-${sf.font_heading})` } : {}),
    ...(sf.font_body ? { '--font-body': `var(--f-${sf.font_body})` } : {}),
  } as CSSProperties;

  return (
    <html lang="en" data-theme={isTheme(s.home_theme) ? s.home_theme : 'luxora'} className={fontVars} style={style}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
