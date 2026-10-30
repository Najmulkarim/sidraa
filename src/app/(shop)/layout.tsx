import type { ReactNode } from 'react';
import { CartProvider } from '@/components/shop/CartProvider';
import { FacebookPixel } from '@/components/shop/FacebookPixel';
import { LiveChat } from '@/components/shop/LiveChat';
import { Footer } from '@/components/shop/Footer';
import { Header } from '@/components/shop/Header';
import { MobileTabBar } from '@/components/shop/MobileTabBar';
import { BackToTop } from '@/components/shop/BackToTop';
import { WhatsAppButton } from '@/components/shop/WhatsAppButton';
import { getSettings, getShopCategories, getZones } from '@/lib/catalog';
import { parseStorefront } from '@/lib/storefront';

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [settings, categories, zones] = await Promise.all([getSettings(), getShopCategories(), getZones()]);
  const { layout, live_chat: liveChat } = parseStorefront(settings.storefront);
  // Floating buttons stack on the right, bottom to top: live chat, WhatsApp, back to top (rem).
  const showWhatsApp = layout.whatsapp && !!settings.phone;
  const aboveChat = liveChat ? 4.5 : 0;
  const aboveWhatsApp = aboveChat + (showWhatsApp ? 3.75 : 0);
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:text-brand focus:py-2">
        Skip to content
      </a>
      {settings.fb_pixel_id && <FacebookPixel pixelId={settings.fb_pixel_id} />}
      {liveChat && <LiveChat id={liveChat} />}
      <Header settings={settings} categories={categories} zones={zones} theme={settings.home_theme} />
      <main id="main">{children}</main>
      <Footer settings={settings} categories={categories} tone={settings.home_theme === 'luxora' || settings.home_theme === 'nova' ? 'dark' : 'light'} />
      {layout.bottom_nav && <MobileTabBar phone={settings.phone} />}
      {layout.back_to_top && <BackToTop raised={layout.bottom_nav} lift={aboveWhatsApp} />}
      {showWhatsApp && settings.phone && <WhatsAppButton phone={settings.phone} raised={layout.bottom_nav} lift={aboveChat} />}
    </CartProvider>
  );
}
