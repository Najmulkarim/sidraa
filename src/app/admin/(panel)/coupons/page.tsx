import type { Metadata } from 'next';
import Link from 'next/link';
import { CouponManager, type Coupon } from '@/components/admin/CouponManager';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Coupons' };

export default async function CouponsPage() {
  const [{ supabase, can }, settings] = await Promise.all([requirePermission('catalog'), getSettings()]);
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Coupons</h1>
        {!settings.coupons_enabled && (
          <p className="mt-2 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
            The coupon field is switched off at checkout.{' '}
            {can.has('store_settings') ? <Link href="/admin/settings" className="underline">Turn it on in Settings → Store</Link> : 'A super admin can turn it on in Settings.'}
          </p>
        )}
      </header>
      <CouponManager coupons={(data ?? []) as Coupon[]} />
    </div>
  );
}
