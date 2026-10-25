import type { ReactNode } from 'react';
import { CartProvider } from '@/components/shop/CartProvider';
import { FacebookPixel } from '@/components/shop/FacebookPixel';
import { Footer } from '@/components/shop/Footer';
import { Header } from '@/components/shop/Header';
import { MobileTabBar } from '@/components/shop/MobileTabBar';
import { getCategories, getSettings, getZones } from '@/lib/catalog';

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [settings, categories, zones] = await Promise.all([getSettings(), getCategories(), getZones()]);
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:text-brand focus:py-2">
        Skip to content
      </a>
      {settings.fb_pixel_id && <FacebookPixel pixelId={settings.fb_pixel_id} />}
      <Header settings={settings} categories={categories} zones={zones} />
      <main id="main">{children}</main>
      <Footer settings={settings} categories={categories} />
      <MobileTabBar phone={settings.phone} />
    </CartProvider>
  );
}
