'use client';

import { useEffect } from 'react';
import { trackPixel, type PixelContent } from '@/lib/facebook/pixel';

/**
 * Browser Purchase event on the confirmation page, once per order on this
 * browser — even if the customer opens the order page again later in a new tab
 * (event id = order reference, so Meta can also match it to the server event).
 */
export function TrackPurchase({ orderRef, value, contents }: { orderRef: string; value: number; contents: PixelContent[] }) {
  useEffect(() => {
    const key = `fbp-purchase:${orderRef}`;
    try {
      if (localStorage.getItem(key) || sessionStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* storage blocked: send anyway; Meta de-duplicates by event id */
    }
    // The Pixel script loads after hydration; give it a moment.
    const t = setTimeout(() => {
      trackPixel('Purchase', { value, content_type: 'product', content_ids: contents.map((c) => c.id), contents, num_items: contents.reduce((n, c) => n + c.quantity, 0) }, orderRef);
    }, 800);
    return () => clearTimeout(t);
  }, [orderRef, value, contents]);
  return null;
}
