/**
 * Zod schemas shared by forms and Server Actions. Every action parses its
 * input here first; the database repeats the critical checks (phone, stock,
 * prices, lengths) so a bug in one layer is caught by the other.
 * Unknown fields are dropped (z.object strips by default).
 */
import { z } from 'zod';
import { normalizeBdPhone } from './phone';
import { SLUG_RE } from './slug';
import { ORDER_STATUSES } from './order-status';

// ---------------------------------------------------------------- helpers

/** '' and whitespace → undefined, so optional fields stay optional. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `Keep it under ${max} characters`).optional());

const money = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is too large`)
    .refine((n) => Math.round(n * 100) === n * 100, `${label} can have at most 2 decimals`);

const optionalMoney = (label: string) => z.preprocess(blankToUndefined, money(label).optional());

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

const jsonField = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  }, schema);

/** Flattens Zod issues to { 'field.path': 'first message' }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** FormData → plain object (last value wins; use getAll for lists). */
export function formToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith('$ACTION')) out[k] = v;
  return out;
}

// --------------------------------------------------------------- checkout

export const cartLineSchema = z.object({
  variantId: z.uuid('Invalid item'),
  quantity: z.coerce.number().int().min(1, 'At least 1').max(20, 'At most 20 of one item'),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const cartLinesSchema = z
  .array(cartLineSchema)
  .min(1, 'Your cart is empty')
  .max(20, 'At most 20 different items per order');

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid('Please reload the page and try again'),
  customerName: z.string().trim().min(2, 'Enter your name').max(80, 'Name is too long'),
  customerPhone: z
    .string()
    .trim()
    .refine((v) => normalizeBdPhone(v) !== null, 'Enter a valid mobile number, e.g. 01712345678')
    .transform((v) => normalizeBdPhone(v) as string),
  address: z.string().trim().min(5, 'Enter your full address (house, road, area)').max(300, 'Address is too long'),
  district: z.string().trim().min(2, 'Enter your district').max(60, 'District is too long'),
  area: optionalText(60),
  zoneId: z.uuid('Choose a delivery area'),
  note: optionalText(500),
  couponCode: z.preprocess(blankToUndefined, z.string().trim().toUpperCase().max(24).optional()),
  items: jsonField(cartLinesSchema),
  paymentMethod: z.preprocess((v) => (v === 'bkash' || v === 'nagad' ? v : 'cod'), z.enum(['cod', 'bkash', 'nagad'])),
  paymentMode: z.preprocess((v) => (v === 'manual' || v === 'merchant' ? v : undefined), z.enum(['manual', 'merchant']).optional()),
  paymentSender: z.preprocess(blankToUndefined, z.string().trim().max(20).optional()),
  paymentTrxId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : undefined),
    z.string().max(40).optional(),
  ),
}).superRefine((p, ctx) => {
  if (p.paymentMethod === 'cod') return;
  if (!p.paymentMode) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Choose how you will pay' });
  if (p.paymentMode === 'manual') {
    if (!p.paymentSender || !normalizeBdPhone(p.paymentSender)) ctx.addIssue({ code: 'custom', path: ['paymentSender'], message: 'Enter the number you sent the money from' });
    if (!p.paymentTrxId || !/^[A-Z0-9]{6,20}$/.test(p.paymentTrxId)) ctx.addIssue({ code: 'custom', path: ['paymentTrxId'], message: 'Enter the Transaction ID from the payment SMS' });
  }
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// --------------------------------------------------------------- tracking

export const trackSchema = z.object({
  ref: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((v) => /^[A-Z]{0,10}\d{1,12}$/.test(v) || (v.length >= 10 && v.length <= 12), 'Enter your order number, e.g. Order0001'),
  phoneLast4: z.string().trim().regex(/^\d{4}$/, 'Enter the last 4 digits of your phone number'),
});

// ------------------------------------------------------------------ admin

export const loginSchema = z.object({
  email: z.email('Enter your email').max(120),
  password: z.string().min(8, 'Enter your password').max(200),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export const variantInputSchema = z.object({
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
  /** Empty on a new variation: the database assigns <product SKU>-01, -02, … */
  sku: z.string().trim().max(64).regex(/^[A-Za-z0-9._-]*$/, 'Letters, numbers, . _ - only').default(''),
  size: z.string().trim().max(20, 'Keep it under 20 characters').default(''),
  color: z.string().trim().max(30, 'Keep it under 30 characters').default(''),
  option3: z.string().trim().max(30, 'Keep it under 30 characters').default(''),
  /** One of the product's photos (checked again by the database). */
  imagePath: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().max(300).nullable()).default(null),
  price: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), money('Variant price').nullable()),
  /** What one piece of this variation costs the shop; empty = the product's cost price. */
  cost: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), money('Cost').nullable()).default(null),
  isActive: z.boolean().default(true),
  /** 1, 2, 3… once the rows have been dragged; 0 keeps the automatic order. */
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  openingStock: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

const PHOTO_PATH = /^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/;

export const productSchema = z
  .object({
    id: z.preprocess(blankToUndefined, z.uuid().optional()),
    /** New products: id chosen in the browser so photos can be uploaded before the first save. */
    newId: z.preprocess(blankToUndefined, z.uuid().optional()),
    /** New products: photos already uploaded to Storage, in display order. */
    photos: z.preprocess(
      (v) => (v === undefined || v === '' ? '[]' : v),
      jsonField(z.array(z.object({ path: z.string().regex(PHOTO_PATH, 'Invalid photo'), alt: z.string().trim().max(200).optional() })).max(20, 'At most 20 photos')),
    ),
    name: z.string().trim().min(1, 'Name is required').max(160),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Use lowercase letters, numbers and dashes').max(120),
    categoryId: z.preprocess(blankToUndefined, z.uuid().optional()),
    description: optionalText(10_000),
    basePrice: money('Price'),
    compareAtPrice: optionalMoney('Compare-at price'),
    /** What one piece costs the shop (for profit). Staff-only, never on the shop. */
    costPrice: optionalMoney('Cost price'),
    discountStyle: z.preprocess((v) => (v === 'amount' ? 'amount' : 'percent'), z.enum(['percent', 'amount'])),
    status: z.enum(['draft', 'published', 'archived']),
    isFeatured: checkbox,
    stockOutMode: z.preprocess((v) => (v === 'preorder' || v === 'continue' ? v : 'sold_out'), z.enum(['sold_out', 'preorder', 'continue'])),
    preorderDays: z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().int('Whole days').min(1, 'At least 1 day').max(180, 'At most 180 days').optional()),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    colorLabel: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : 'Color'), z.string().trim().max(20, 'At most 20 characters')),
    sizeLabel: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : 'Size'), z.string().trim().max(20, 'At most 20 characters')),
    option3Label: optionalText(20),
    variants: jsonField(z.array(variantInputSchema).min(1, 'Add at least one variant').max(50)),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== undefined && p.compareAtPrice <= p.basePrice) {
      ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'The discount must leave a price above ৳0' });
    }
    if (p.variants.some((v) => v.option3) && !p.option3Label) {
      ctx.addIssue({ code: 'custom', path: ['option3Label'], message: 'Name the third option (e.g. Sleeve)' });
    }
    const skus = new Set<string>();
    const combos = new Set<string>();
    p.variants.forEach((v, i) => {
      const sku = v.sku.toUpperCase();
      if (!sku && v.id) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU is required' });
      if (sku && skus.has(sku)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU is used twice' });
      skus.add(sku);
      const combo = `${v.color.toLowerCase()}|${v.size.toLowerCase()}|${v.option3.toLowerCase()}`;
      if (combos.has(combo)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'size'], message: 'This combination is listed twice' });
      combos.add(combo);
    });
  });
export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Use lowercase letters, numbers and dashes').max(80),
  description: optionalText(2000),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
  isPublic: checkbox,
});

export const imageMetaSchema = z.object({
  productId: z.uuid(),
  storagePath: z
    .string()
    .regex(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/, 'Invalid image path'),
  alt: optionalText(200),
});

export const statusChangeSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
});

export const noteSchema = z.object({
  orderId: z.uuid(),
  body: z.string().trim().min(1, 'Write a note').max(1000, 'Keep it under 1000 characters'),
});

export const paymentSchema = z.object({
  orderId: z.uuid(),
  paid: money('Paid amount'),
});

export const editCustomerSchema = z.object({
  orderId: z.uuid(),
  customerName: z.string().trim().min(2, 'Enter the name').max(80),
  customerPhone: z
    .string()
    .trim()
    .refine((v) => normalizeBdPhone(v) !== null, 'Enter a valid mobile number')
    .transform((v) => normalizeBdPhone(v) as string),
  address: z.string().trim().min(5, 'Enter the full address').max(300),
  district: z.string().trim().min(2, 'Enter the district').max(60),
  area: optionalText(60),
  note: optionalText(500),
  paid: optionalMoney('Paid amount'),
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.uuid()).min(1, 'Select at least one order').max(200, 'At most 200 orders at a time'),
  status: z.enum(ORDER_STATUSES),
});

export const adjustStockSchema = z.object({
  variantId: z.uuid(),
  change: z.coerce
    .number({ error: 'Enter a whole number' })
    .int('Enter a whole number')
    .refine((n) => n !== 0, 'Enter a non-zero amount')
    .refine((n) => Math.abs(n) <= 100_000, 'Too large'),
  reason: z.enum(['restock', 'adjust']),
  note: optionalText(300),
});

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #6b2d3c');
const optionalUrl = z.preprocess(blankToUndefined, z.url({ protocol: /^https$/, error: 'Use a full https:// link' }).max(300).optional());

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, 'Store name is required').max(80),
  tagline: optionalText(120),
  phone: optionalText(30),
  email: z.preprocess(blankToUndefined, z.email('Enter a valid email').max(120).optional()),
  address: optionalText(300),
  facebook: optionalUrl,
  instagram: optionalUrl,
  tiktok: optionalUrl,
  youtube: optionalUrl,
  codTerms: z.string().trim().min(10, 'Describe your cash-on-delivery terms').max(2000),
  returnPolicyDays: z.coerce.number().int().min(0).max(60),
  /** Old setting: new orders are numbered Order0001, Order0002, … Kept optional for older forms. */
  orderRefPrefix: z.preprocess(blankToUndefined, z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, '2 to 4 capital letters').optional()),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  announcement: optionalText(160),
  couponsEnabled: checkbox,
  themePrimary: hexColor,
  themeAccent: hexColor,
});

export const zoneSchema = z.object({
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, 'Name is required').max(60),
  charge: money('Charge'),
  freeOver: optionalMoney('Free-delivery threshold'),
  etaText: optionalText(60),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
  isActive: checkbox,
});

// ------------------------------------------------- full order edit / manual order

export const ORDER_SOURCES = ['website', 'phone', 'facebook', 'whatsapp', 'instagram', 'other'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const orderLineSchema = z.object({
  variantId: z.uuid('Choose a product size'),
  quantity: z.coerce.number().int('Whole numbers only').min(1, 'At least 1').max(99, 'At most 99'),
  unitPrice: money('Price').refine((n) => n <= 1_000_000, 'Price is too large'),
});

export const orderEditSchema = z.object({
  orderId: z.preprocess(blankToUndefined, z.uuid().optional()),
  idempotencyKey: z.preprocess(blankToUndefined, z.uuid().optional()),
  customerName: z.string().trim().min(2, 'Enter the name').max(80),
  customerPhone: z
    .string()
    .trim()
    .refine((v) => normalizeBdPhone(v) !== null, 'Enter a valid mobile number')
    .transform((v) => normalizeBdPhone(v) as string),
  address: z.string().trim().min(5, 'Enter the full address').max(300),
  district: z.string().trim().min(2, 'Enter the district').max(60),
  area: optionalText(60),
  note: optionalText(500),
  zoneId: z.uuid('Choose a delivery area'),
  /** blank → charge from the delivery area */
  deliveryCharge: optionalMoney('Delivery charge'),
  discount: z.preprocess((v) => (v === '' || v === undefined || v === null ? 0 : v), money('Discount')),
  source: z.enum(ORDER_SOURCES),
  status: z.preprocess(blankToUndefined, z.enum(['pending', 'confirmed']).optional()),
  paid: optionalMoney('Paid amount'),
  items: jsonField(z.array(orderLineSchema).min(1, 'Add at least one item').max(30, 'At most 30 lines')),
}).superRefine((o, ctx) => {
  if (!o.orderId && !o.idempotencyKey) ctx.addIssue({ code: 'custom', path: ['_form'], message: 'Please reload the page and try again' });
  const subtotal = o.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (o.discount > subtotal) ctx.addIssue({ code: 'custom', path: ['discount'], message: 'Discount cannot be more than the items total' });
});
export type OrderEditInput = z.infer<typeof orderEditSchema>;

// ------------------------------------------------------- coupons, block list, staff

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, '3–24 letters, numbers, - or _'),
  kind: z.enum(['percent', 'fixed']),
  value: money('Value').refine((n) => n > 0, 'Enter a value'),
  minSubtotal: z.preprocess((v) => (v === '' || v === undefined ? 0 : v), money('Minimum order')),
  maxDiscount: optionalMoney('Maximum discount'),
  startsAt: z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date').optional()),
  endsAt: z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date').optional()),
  usageLimit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1, 'At least 1').max(1_000_000).optional()),
  isActive: checkbox,
  existing: checkbox,
}).superRefine((c, ctx) => {
  if (c.kind === 'percent' && c.value > 90) ctx.addIssue({ code: 'custom', path: ['value'], message: 'At most 90%' });
  if (c.startsAt && c.endsAt && c.endsAt < c.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start date' });
});

export const blockSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeBdPhone(v) !== null, 'Enter a valid mobile number')
    .transform((v) => normalizeBdPhone(v) as string),
  reason: optionalText(200),
});

export const staffSchema = z.object({
  userId: z.preprocess(blankToUndefined, z.uuid().optional()),
  fullName: z.string().trim().min(1, 'Enter a name').max(80),
  email: z.preprocess(blankToUndefined, z.email('Enter a valid email').max(120).optional()),
  password: z.preprocess(blankToUndefined, z.string().min(10, 'At least 10 characters').max(200).optional()),
  role: z.enum(['super_admin', 'manager', 'support']),
  isActive: checkbox,
}).superRefine((s, ctx) => {
  if (!s.userId && !s.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter the email they will sign in with' });
  if (!s.userId && !s.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Set a first password (they can change it later)' });
});

// ---------------------------------------------------------- courier / marketing settings

const secret = z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(300).optional());

export const courierSettingsSchema = z.object({
  defaultCourier: z.preprocess(blankToUndefined, z.enum(['steadfast', 'pathao']).optional()),
  steadfastBaseUrl: z.preprocess(blankToUndefined, z.url({ protocol: /^https$/, error: 'Use an https:// address' }).max(200).optional()),
  steadfastApiKey: secret,
  steadfastSecretKey: secret,
  steadfastWebhookToken: secret,
  pathaoSandbox: checkbox,
  pathaoClientId: secret,
  pathaoClientSecret: secret,
  pathaoUsername: z.preprocess(blankToUndefined, z.email('Enter the Pathao merchant email').max(120).optional()),
  pathaoPassword: secret,
  pathaoStoreId: z.preprocess(blankToUndefined, z.string().trim().regex(/^\d{1,12}$/, 'Numbers only').optional()),
  pathaoWebhookSecret: secret,
  pathaoIntegrationSecret: secret,
  defaultWeightKg: z.coerce.number().min(0.5, 'At least 0.5 kg').max(10, 'At most 10 kg'),
  parcelNote: optionalText(200),
  autoSync: checkbox,
});

export const marketingSettingsSchema = z.object({
  fbPixelId: z.preprocess(blankToUndefined, z.string().trim().regex(/^\d{6,20}$/, 'The Pixel ID is a number, e.g. 123456789012345').optional()),
  capiEnabled: checkbox,
  capiToken: secret,
  capiTestCode: optionalText(40),
  graphVersion: z.string().trim().regex(/^v\d{1,3}\.\d$/, 'Like v26.0'),
});
