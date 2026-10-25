import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/components/shop/CartProvider';
import { Footer } from '@/components/shop/Footer';
import { Header } from '@/components/shop/Header';
import { requirePermission } from '@/lib/auth';
import { getSettings, getShopCategories, getZones } from '@/lib/catalog';
import { isTheme } from '@/lib/home-sections';

/** Staff-only theme preview: the shop as it would look with this theme — its own header, fonts and footer. No Pixel. */
export default async function PreviewLayout({ children, params }: { children: ReactNode; params: Promise<{ theme: string }> }) {
  const [{ theme }] = await Promise.all([params, requirePermission('store_settings')]);
  if (!isTheme(theme)) notFound();
  const [settings, categories, zones] = await Promise.all([getSettings(), getShopCategories(), getZones()]);
  return (
    <CartProvider>
      {/* The theme's fonts and colours apply to everything inside, body text included. */}
      <div data-theme={theme} className="font-[family-name:var(--font-body)]">
        <Header settings={settings} categories={categories} zones={zones} theme={theme} />
        <main id="main">{children}</main>
        <Footer settings={settings} categories={categories} tone={theme === 'luxora' || theme === 'nova' ? 'dark' : 'light'} />
      </div>
    </CartProvider>
  );
}
