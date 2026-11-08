import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import localFont from 'next/font/local';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import { isTheme } from '@/lib/home-sections';
import { imageUrl } from '@/lib/env';
import { parseStorefront } from '@/lib/storefront';
import './globals.css';

// One pair per home theme (globals.css maps [data-theme] to them). Not preloaded:
// the browser only downloads the faces the live theme actually uses.
// The font files live in src/fonts (Google Fonts, latin, OFL licence): a build never
// has to download them, so a slow or failed Google download cannot stop an update.
// (next/font needs every value written out here, not computed.)
const cormorant = localFont({ src: '../fonts/cormorant-500-700.woff2', weight: '500 700', display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--f-cormorant' });
const jost = localFont({ src: '../fonts/jost-400-700.woff2', weight: '400 700', display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--f-jost' });
const poppins = localFont({
  src: [
    { path: '../fonts/poppins-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/poppins-700.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/poppins-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
  variable: '--f-poppins',
});
const playfair = localFont({ src: '../fonts/playfair-500-700.woff2', weight: '500 700', display: 'swap', preload: false, adjustFontFallback: 'Times New Roman', variable: '--f-playfair' });
const inter = localFont({ src: '../fonts/inter-400-700.woff2', weight: '400 700', display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--f-inter' });
const jakarta = localFont({ src: '../fonts/jakarta-400-800.woff2', weight: '400 800', display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--f-jakarta' });
// Handwritten accent lines (Nova).
const script = localFont({ src: '../fonts/script-400-700.woff2', weight: '400 700', display: 'swap', preload: false, adjustFontFallback: 'Arial', variable: '--f-script' });
const fontVars = [cormorant, jost, poppins, playfair, inter, jakarta, script].map((f) => f.variable).join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.tagline ?? `Shop ${s.store_name} online. Cash on delivery across Bangladesh.`;
  const sf = parseStorefront(s.storefront);
  const uploaded = imageUrl(sf.favicon);
  // A small copy through the image optimiser: the upload itself can be large.
  const icon = (w: number) => (uploaded && !uploaded.startsWith('/') ? `/_next/image?url=${encodeURIComponent(uploaded)}&w=${w}&q=75` : uploaded);
  const favicon = icon(64);
  const og = imageUrl(sf.og_image);
  const title = sf.site_title || s.store_name;
  return {
    metadataBase: new URL(SITE_URL),
    icons: { icon: favicon ?? '/brand/favicon.png', apple: icon(256) ?? '/brand/apple-icon.png' },
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
