import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/catalog';

/** Lets phones install the shop to the home screen and open it like an app. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: s.store_name,
    short_name: s.store_name,
    description: s.tagline ?? `Shop ${s.store_name} online. Cash on delivery across Bangladesh.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
