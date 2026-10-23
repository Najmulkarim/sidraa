import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { dhakaToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Products CSV, one row per variant, with current stock. */
export async function GET() {
  const session = await getAdmin();
  if (!session?.profile || session.needsMfa || !session.can.has('catalog')) return new NextResponse('Not allowed', { status: 403 });

  const { data, error } = await session.supabase
    .from('product_variants')
    .select('sku, size, color, option3, image_path, price, stock, is_active, product:products(name, slug, status, base_price, compare_at_price, category:categories(name))')
    .order('sku')
    .limit(10_000);
  if (error) return new NextResponse('Export failed', { status: 500 });

  type Row = {
    sku: string; size: string; color: string; option3: string; image_path: string | null; price: number | null; stock: number; is_active: boolean;
    product: { name: string; slug: string; status: string; base_price: number; compare_at_price: number | null; category: { name: string } | null } | null;
  };

  const csv = toCsv(
    ['Product', 'Web address', 'Category', 'Status', 'SKU', 'Colour', 'Size', 'Option 3', 'Variation photo', 'Price', 'Compare-at', 'Stock', 'Variant active'],
    ((data ?? []) as unknown as Row[]).map((v) => [
      v.product?.name ?? '', v.product?.slug ?? '', v.product?.category?.name ?? '', v.product?.status ?? '',
      v.sku, v.color, v.size, v.option3, v.image_path ?? '', v.price ?? v.product?.base_price ?? '', v.product?.compare_at_price ?? '', v.stock, v.is_active ? 'yes' : 'no',
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products_${dhakaToday()}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
