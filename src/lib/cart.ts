/**
 * Cart model. The browser stores only {variantId, quantity} plus display
 * hints (name, image) so the cart renders instantly; prices always come
 * from the server quote (quote_order). Pure functions — tested in
 * tests/unit/cart.test.ts.
 */

export const CART_STORAGE_KEY = 'cart:v1';
/** httpOnly cookie that lets the ordering browser see its full confirmation. */
export const LAST_ORDER_COOKIE = 'last_order';
export const MAX_LINES = 20;
export const MAX_QTY = 20;

export type CartLine = {
  variantId: string;
  quantity: number;
  // Display hints only — never trusted for price.
  productName?: string;
  productSlug?: string;
  variantLabel?: string;
  imagePath?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n)));
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/** Parses whatever is in localStorage; drops anything malformed. */
export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: CartLine[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.variantId !== 'string' || !UUID.test(r.variantId)) continue;
    const q = Number(r.quantity);
    if (!Number.isFinite(q) || q < 1) continue;
    out.push({
      variantId: r.variantId,
      quantity: clampQty(q),
      productName: str(r.productName, 160),
      productSlug: str(r.productSlug, 120),
      variantLabel: str(r.variantLabel, 60),
      imagePath: typeof r.imagePath === 'string' ? r.imagePath.slice(0, 300) : null,
    });
  }
  return mergeDuplicates(out).slice(0, MAX_LINES);
}

function mergeDuplicates(lines: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const l of lines) {
    const prev = map.get(l.variantId);
    map.set(l.variantId, prev ? { ...prev, quantity: clampQty(prev.quantity + l.quantity) } : l);
  }
  return [...map.values()];
}

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQty'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }
  | { type: 'replace'; lines: CartLine[] };

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((l) => l.variantId === action.line.variantId);
      if (existing) {
        return state.map((l) =>
          l.variantId === action.line.variantId ? { ...l, ...action.line, quantity: clampQty(l.quantity + action.line.quantity) } : l,
        );
      }
      if (state.length >= MAX_LINES) return state;
      return [...state, { ...action.line, quantity: clampQty(action.line.quantity) }];
    }
    case 'setQty':
      if (action.quantity < 1) return state.filter((l) => l.variantId !== action.variantId);
      return state.map((l) => (l.variantId === action.variantId ? { ...l, quantity: clampQty(action.quantity) } : l));
    case 'remove':
      return state.filter((l) => l.variantId !== action.variantId);
    case 'clear':
      return [];
    case 'replace':
      return mergeDuplicates(action.lines).slice(0, MAX_LINES);
  }
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

/** The only part of the cart sent to the server. */
export function toOrderItems(lines: CartLine[]): { variantId: string; quantity: number }[] {
  return lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
}
