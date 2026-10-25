import { NextResponse, type NextRequest } from 'next/server';
import { refreshCatalog } from '@/lib/facebook/catalog';
import { safeEqual } from '@/lib/secure-compare';

/** Daily Facebook catalog refresh (vercel.json schedule; Vercel sends "Authorization: Bearer $CRON_SECRET"). */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await refreshCatalog());
}
