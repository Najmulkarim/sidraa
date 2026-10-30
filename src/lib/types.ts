/**
 * Row shapes used by the app. Hand-written to match the migrations; after
 * `supabase start` you can generate exact types with `npm run db:types`.
 * Numeric columns may arrive as number or string — use toNumber().
 */
import type { OrderStatus } from './order-status';

type Numeric = number | string;

export type StoreSettings = {
  store_name: string;
  tagline: string | null;
  logo_path: string | null;
  theme: { primary?: string; accent?: string };
  phone: string | null;
  email: string | null;
  address: string | null;
  social: { facebook?: string; instagram?: string; tiktok?: string; youtube?: string };
  cod_terms: string;
  return_policy_days: number;
  order_ref_prefix: string;
  low_stock_threshold: number;
  fb_pixel_id: string | null;
  announcement: string | null;
  coupons_enabled: boolean;
  /** Which home page theme is live (luxora, shopease, luxe, novatrend). */
  home_theme: string;
  /** Header / footer parts, fonts, favicon, invoice … (see lib/storefront.ts). */
  storefront: unknown;
  /** "Order" → Order0001; or a capitals prefix like SDR → SDR0001. */
  order_number_prefix: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  is_public: boolean;
};

export type ProductStatus = 'draft' | 'published' | 'archived';

export type ProductImage = { id: string; storage_path: string; alt: string | null; sort_order: number };

export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  /** Third variation type, named by Product.option3_label. */
  option3: string;
  /** One of the product's photos, shown when this variation is picked. */
  image_path: string | null;
  price: Numeric | null;
  stock: number;
  is_active: boolean;
  /** Position in the admin's order; 0 = never arranged (automatic order). */
  sort_order: number;
};

export type Product = {
  id: string;
  /** "Mother" SKU (SKU-0008); its variations are SKU-0008-01, SKU-0008-02, … */
  sku: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  base_price: Numeric;
  compare_at_price: Numeric | null;
  /** How the discount badge reads: percent (20% OFF) or amount (৳200 OFF). */
  discount_style: 'percent' | 'amount';
  /** Out of stock: sold_out (as usual), preorder (Pre-order, delivered in preorder_days) or continue (keeps selling, no tag). */
  stock_out_mode: 'sold_out' | 'preorder' | 'continue';
  preorder_days: number | null;
  status: ProductStatus;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  color_label: string;
  size_label: string;
  option3_label: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** From approved customer reviews only (null / 0 until the first one). */
  rating_avg: Numeric | null;
  rating_count: number;
};

export type ProductWithRelations = Product & {
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  images: ProductImage[];
  variants: Variant[];
};

export type DeliveryZone = {
  id: string;
  name: string;
  charge: Numeric;
  free_over: Numeric | null;
  eta_text: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Order = {
  id: string;
  public_ref: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  address: string;
  district: string;
  area: string | null;
  zone_name: string;
  note: string | null;
  subtotal: Numeric;
  discount: Numeric;
  delivery_charge: Numeric;
  total: Numeric;
  payment_method: 'cod' | 'bkash' | 'nagad';
  payment_mode: 'manual' | 'merchant' | null;
  /** none = cash on delivery; pending = waiting for the gateway or for staff to check the TrxID. */
  payment_status: 'none' | 'pending' | 'paid' | 'failed';
  payment_sender: string | null;
  payment_trx_id: string | null;
  stock_released: boolean;
  confirmed_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  returned_at: string | null;
  redacted_at: string | null;
  paid_amount: Numeric;
  assigned_to: string | null;
  deleted_at: string | null;
  hold_at: string | null;
  lost_at: string | null;
  fake_at: string | null;
  source: 'website' | 'phone' | 'facebook' | 'whatsapp' | 'instagram' | 'other';
  coupon_code: string | null;
  created_by: string | null;
  zone_id: string | null;
  courier: 'steadfast' | 'pathao' | null;
  courier_consignment_id: string | null;
  courier_tracking_code: string | null;
  courier_status: string | null;
  courier_charge: Numeric | null;
  courier_sent_at: string | null;
  courier_synced_at: string | null;
  courier_error: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderNote = { id: number; kind: 'note' | 'system'; body: string; created_by: string | null; created_at: string };
export type Staff = { user_id: string; full_name: string; role: import('./permissions').AdminRole };
export type CustomerStat = { phone: string; orders: number; delivered: number; failed: number };

export type OrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string;
  variant_label: string;
  unit_price: Numeric;
  quantity: number;
  line_total: Numeric;
  /** Sold beyond the stock at the time: preorder (shown to the customer) or continue (staff only). */
  backorder?: 'preorder' | 'continue' | null;
};

export type OrderHistory = {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export type QuoteLine =
  | { variant_id: string; quantity: number; state: 'unavailable'; line_total: number }
  | {
      variant_id: string;
      product_id: string;
      product_name: string;
      product_slug: string;
      sku: string;
      variant_label: string;
      unit_price: number;
      quantity: number;
      line_total: number;
      stock_left: number;
      /** Out of stock but taken as a pre-order (delivery in preorder_days). */
      preorder?: boolean;
      preorder_days?: number | null;
      state: 'ok' | 'insufficient' | 'sold_out';
    };

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  coupon: { code: string; discount: number; error: string | null } | null;
  delivery_charge: number | null;
  total: number | null;
};

export type TrackResult = {
  public_ref: string;
  status: OrderStatus;
  placed_at: string;
  confirmed_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  returned_at: string | null;
  zone_name: string;
  subtotal: number;
  delivery_charge: number;
  total: number;
  items: { product_name: string; variant_label: string; quantity: number; line_total: number }[];
};

/** Result shape every Server Action returns to its form. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

/** A product size the order editor can add. */
export type VariantOption = {
  variant_id: string;
  product_name: string;
  label: string;
  sku: string;
  price: number;
  stock: number;
  image: string | null;
};

/** What the order editor loads for an existing order. */
export type EditableOrder = {
  id: string;
  public_ref: string;
  status: import('./order-status').OrderStatus;
  customer_name: string;
  customer_phone: string;
  address: string;
  district: string;
  area: string | null;
  note: string | null;
  zone_id: string | null;
  zone_name: string;
  delivery_charge: number;
  discount: number;
  paid_amount: number;
  total: number;
  source: Order['source'];
  courier_consignment_id: string | null;
  items: { variant_id: string | null; product_name: string; variant_label: string; sku: string; unit_price: number; quantity: number }[];
};
