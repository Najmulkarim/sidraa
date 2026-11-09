import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountingTabs, usedCouriers } from '@/components/admin/AccountingTabs';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { CourierInsightChart } from '@/components/admin/CourierInsightChart';
import { Icon } from '@/components/icons';
import { requirePermission } from '@/lib/auth';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';
import { courierInsight, INSIGHT_GROUPS, type InsightKey, type InsightOrder } from '@/lib/courier-insight';
import { addDays, dhakaDayStartUtc, dhakaToday, formatDateTime, formatMoney, formatTaka, resolveRange } from '@/lib/format';

export const metadata: Metadata = { title: 'Courier' };

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this-year', label: 'This year' },
] as const;

export default async function CourierInsightPage({ params, searchParams }: {
  params: Promise<{ courier: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const [{ supabase }, { courier: raw }, sp] = await Promise.all([requirePermission('revenue'), params, searchParams]);
  if (!(raw in COURIER_LABEL)) notFound();
  const courier = raw as CourierName;
  const name = COURIER_LABEL[courier];
  const today = dhakaToday();
  const range = resolveRange(sp.range ?? '30d', sp.from, sp.to, new Date(), 3650);

  const [couriers, { data, error }] = await Promise.all([
    usedCouriers(supabase),
    // Like the courier's own dashboard: parcels by the day they were handed to it.
    supabase.from('orders')
      .select('id, public_ref, status, courier_status, courier_charge, courier_collected, courier_cod_fee, total, paid_amount, paid_before_delivery, courier_sent_at')
      .eq('courier', courier).is('deleted_at', null).not('courier_consignment_id', 'is', null)
      .gte('courier_sent_at', dhakaDayStartUtc(range.from)).lt('courier_sent_at', dhakaDayStartUtc(addDays(range.to, 1)))
      .order('courier_sent_at', { ascending: false }).limit(5000),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the {name} parcels. Run the latest database update (0064) in Supabase, then reload.</p>
      </div>
    );
  }

  const ins = courierInsight((data ?? []) as (InsightOrder & { courier_sent_at: string })[]);
  const sentAt = new Map((data ?? []).map((o) => [o.id, o.courier_sent_at as string]));
  const label = Object.fromEntries(INSIGHT_GROUPS.map((g) => [g.key, g])) as Record<InsightKey, (typeof INSIGHT_GROUPS)[number]>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <AccountingTabs active={courier} couriers={couriers.includes(courier) ? couriers : [...couriers, courier]} />
          </div>
          <p className="text-sm text-muted">{name} parcels by the day they were handed over · pickups the courier cancelled are left out, as {name} does.</p>
        </div>
        <DateRangePicker basePath={`/admin/accounting/courier/${courier}`} preset={range.preset} from={range.from} to={range.to} today={today} presets={PRESETS} />
      </header>

      {/* Orders, like the courier's "Order insight". */}
      <CourierInsightChart groups={ins.groups} count={ins.count} amount={ins.amount} />

      {/* Money, like the courier's "COD earnings", worked out from our parcels. */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Cash with {name}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Money label="Collected from customers" value={ins.collected} sub="Delivered parcels and paid returns" />
          <Money label="Delivery charges" value={-ins.fees} sub={ins.missingFee > 0 ? `${ins.missingFee} parcel${ins.missingFee === 1 ? '' : 's'} without the charge yet` : `What ${name} charged`} />
          <Money label="COD fee" value={-ins.codFees} sub={ins.codFeeEstimated > 0 ? `About 1% of the cash (estimate for ${ins.codFeeEstimated})` : `As ${name} reported`} />
          <Money label={`${name} should pay you`} value={ins.payout} sub="Collected − charges − COD fee" strong />
        </div>
        <p className="flex items-start gap-2 text-[12.5px] text-muted">
          <Icon name="note" size={15} className="mt-px shrink-0" />
          <span>
            Worked out from our parcels, so it can differ from {name}&apos;s panel by a few taka{ins.codFeeEstimated > 0 ? ` (its exact COD fee arrives with its webhook messages)` : ''}. Which of it {name} has already paid you, and when, only {name}&apos;s panel shows.
            {ins.toCollect > 0 && <> Still on the road or on hold: <b className="text-ink">{formatTaka(ins.toCollect)}</b> to collect.</>}
          </span>
        </p>
      </section>

      {/* Every parcel, to check against the courier. */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3.5 font-semibold">Parcels ({ins.count})</h2>
        {ins.rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No {name} parcels in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13.5px]">
              <thead className="bg-soft text-left text-[11.5px] font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Handed over</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Collected</th>
                  <th className="px-4 py-2.5 text-right">Charge</th>
                  <th className="px-4 py-2.5 text-right">COD fee</th>
                  <th className="px-4 py-2.5 text-right">You get</th>
                </tr>
              </thead>
              <tbody>
                {ins.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line/70">
                    <td className="px-4 py-2"><Link href={`/admin/orders/${r.id}`} className="font-semibold text-brand hover:underline">{r.public_ref}</Link></td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDateTime(sentAt.get(r.id))}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: label[r.group].color }} aria-hidden />
                        {label[r.group].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{r.toCollect > 0 ? <span className="text-muted">{formatTaka(r.toCollect)} to collect</span> : formatTaka(r.collected)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{r.fee ? formatMoney(-r.fee) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{r.codFee ? <>{formatMoney(-r.codFee)}{r.codFeeEstimated && <span className="text-muted" title="Estimate: about 1%">*</span>}</> : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">{r.toCollect > 0 ? '—' : formatMoney(r.collected - r.fee - r.codFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Money({ label, value, sub, strong }: { label: string; value: number; sub: string; strong?: boolean }) {
  return (
    <div className={`card p-4 ${strong ? 'ring-2 ring-ok/30' : ''}`}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`mt-1 text-[1.45rem] font-bold leading-tight ${strong ? 'text-ok' : ''}`}>{formatMoney(value)}</p>
      <p className="mt-1 text-[12px] text-muted">{sub}</p>
    </div>
  );
}
