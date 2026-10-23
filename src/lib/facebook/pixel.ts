/**
 * Browser Pixel helpers (client side). They do nothing when no Pixel ID is
 * set, so the shop works the same without Facebook.
 */
type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === 'function' ? f : null;
}

export type PixelContent = { id: string; quantity: number; item_price: number };

export function trackPixel(event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase', data: Record<string, unknown>, eventId?: string) {
  const f = fbq();
  if (!f) return;
  f('track', event, { currency: 'BDT', ...data }, eventId ? { eventID: eventId } : undefined);
}
