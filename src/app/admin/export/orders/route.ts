import { NextResponse, type NextRequest } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { addDays, dhakaDayStartUtc, formatDateTime, isYmd, dhakaToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Orders CSV, one row per order item. Read-only GET; admin session required. */
export async function GET(request: NextRequest) {
  const session = await getAdmin();
  if (!session?.profile || session.needsMfa || !session.can.has('orders_export')) return new NextResponse('Not allowed', { status: 403 });

  const sp = request.nextUrl.searchParams;
  const to = isYmd(sp.get('to')) ? (sp.get('to') as string) : dhakaToday();
  const from = isYmd(sp.get('from')) ? (sp.get('from') as string) : addDays(to, -29);

  type Row = {
    public_ref: string; status: string; created_at: string; delivered_at: string | null;
    customer_name: string; customer_phone: string; address: string; area: string | null; district: string; zone_name: string; note: string | null;
    subtotal: number; discount: number; delivery_charge: number; total: number; paid_amount: number;
    source: string; coupon_code: string | null; courier: string | null; courier_consignment_id: string | null; courier_status: string | null;
    items: { product_name: string; variant_label: string; sku: string; unit_price: number; quantity: number; line_total: number }[];
  };

  const rows: Row[] = [];
  // Page through in chunks so a long range does not hit the API row cap.
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await session.supabase
      .from('orders')
      .select('public_ref, status, created_at, delivered_at, customer_name, customer_phone, address, area, district, zone_name, note, subtotal, discount, delivery_charge, total, paid_amount, source, coupon_code, courier, courier_consignment_id, courier_status, items:order_items(product_name, variant_label, sku, unit_price, quantity, line_total)')
      .gte('created_at', dhakaDayStartUtc(from))
      .lt('created_at', dhakaDayStartUtc(addDays(to, 1)))
      .is('deleted_at', null)
      .order('created_at')
      .range(offset, offset + 999);
    if (error) return new NextResponse('Export failed', { status: 500 });
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const csv = toCsv(
    ['Reference', 'Status', 'Placed (Dhaka)', 'Delivered (Dhaka)', 'Customer', 'Phone', 'Address', 'Area', 'District', 'Delivery area', 'Note',
      'Product', 'Variant', 'SKU', 'Unit price', 'Qty', 'Line total', 'Order subtotal', 'Discount', 'Coupon', 'Delivery charge', 'Order total', 'Paid', 'Source', 'Courier', 'Consignment', 'Courier status'],
    rows.flatMap((o) =>
      o.items.map((i) => [
        o.public_ref, o.status, formatDateTime(o.created_at), o.delivered_at ? formatDateTime(o.delivered_at) : '',
        o.customer_name, o.customer_phone, o.address, o.area ?? '', o.district, o.zone_name, o.note ?? '',
        i.product_name, i.variant_label, i.sku, i.unit_price, i.quantity, i.line_total, o.subtotal, o.discount, o.coupon_code ?? '', o.delivery_charge, o.total, o.paid_amount, o.source,
        o.courier ?? '', o.courier_consignment_id ?? '', o.courier_status ?? '',
      ]),
    ),
  );

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders_${from}_to_${to}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
