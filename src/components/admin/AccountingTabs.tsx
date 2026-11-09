import Link from 'next/link';
import type { createClient } from '@/lib/supabase/server';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';

/** Couriers that have carried at least one of our parcels, in a fixed order. */
export async function usedCouriers(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CourierName[]> {
  const names = Object.keys(COURIER_LABEL) as CourierName[];
  const counts = await Promise.all(
    names.map((c) => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('courier', c).not('courier_consignment_id', 'is', null)),
  );
  return names.filter((_, i) => (counts[i]?.count ?? 0) > 0);
}

/** Profit & loss, then one tab per courier, beside the Accounting title. */
export function AccountingTabs({ active, couriers }: { active: 'pnl' | CourierName; couriers: CourierName[] }) {
  if (couriers.length === 0) return null;
  const tabs = [{ key: 'pnl', label: 'Profit & loss', href: '/admin/accounting' }, ...couriers.map((c) => ({ key: c, label: COURIER_LABEL[c], href: `/admin/accounting/courier/${c}` }))];
  return (
    <nav aria-label="Accounting views" className="no-print inline-flex rounded-xl bg-soft p-1 text-[13.5px] font-semibold">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? 'page' : undefined}
          className={`rounded-lg px-3.5 py-1.5 transition ${t.key === active ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
