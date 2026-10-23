import type { Metadata } from 'next';
import Link from 'next/link';
import { unblockPhoneForm } from '@/actions/admin-customers';
import { BlockForm, CustomersTable, type CustomerRow } from '@/components/admin/CustomersTable';
import { Icon } from '@/components/icons';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Customers' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'repeat', label: 'Repeat buyers' },
  { key: 'risky', label: 'More failed than delivered' },
  { key: 'blocked', label: 'Blocked' },
] as const;
const PER_PAGE = 50;

/** Customers grouped by phone number, from orders. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('customers'), searchParams]);
  const q = (sp.q ?? '').trim().slice(0, 60);
  const f = FILTERS.some((x) => x.key === sp.f) ? (sp.f as string) : 'all';
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const [{ data, error }, { data: blockedOnly }] = await Promise.all([
    supabase.rpc('customers_list', { p_q: q || null, p_filter: f, p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE }),
    f === 'blocked' ? supabase.from('blocked_phones').select('phone, reason, created_at').order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: null }),
  ]);
  if (error) console.error('[admin] customers', error);
  const rows = ((data ?? []) as (CustomerRow & { total_count: number })[]);
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const withOrders = new Set(rows.map((r) => r.phone));
  const blockedNoOrders = ((blockedOnly ?? []) as { phone: string; reason: string | null }[]).filter((b) => !withOrders.has(b.phone));
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, f, page, ...patch })) if (v && !(k === 'f' && v === 'all') && !(k === 'page' && v === 1)) p.set(k, String(v));
    return `/admin/customers${p.size ? `?${p}` : ''}`;
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted">Everyone who ordered, by phone number. Block numbers that place fake orders — they will not be able to order on the website.</p>
      </header>

      <section className="rounded-xl border border-line bg-white p-3">
        <form key={`${q}|${f}`} action="/admin/customers" className="flex flex-wrap gap-2">
          {f !== 'all' && <input type="hidden" name="f" value={f} />}
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Search customers</span>
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Search by phone or name…" className="input min-h-10 pl-9" />
          </label>
          <button className="btn btn-primary btn-sm min-h-10">Search</button>
        </form>
        <nav aria-label="Customer filters" className="mt-3 flex gap-1 overflow-x-auto border-t border-line pt-3">
          {FILTERS.map((x) => (
            <Link key={x.key} href={href({ f: x.key, page: 1 })} aria-current={x.key === f ? 'page' : undefined} className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${x.key === f ? 'border-brand bg-tint text-brand' : 'border-transparent hover:bg-soft'}`}>
              {x.label}
            </Link>
          ))}
        </nav>
      </section>

      <CustomersTable rows={rows} />

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={href({ page: page - 1 })} className="btn btn-outline btn-sm">Previous</Link>}
          <span className="text-muted">Page {page} of {pages} · {total} customers</span>
          {page < pages && <Link href={href({ page: page + 1 })} className="btn btn-outline btn-sm">Next</Link>}
        </nav>
      )}

      {f === 'blocked' && blockedNoOrders.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Blocked numbers with no orders</h2>
          <ul className="divide-y divide-line text-sm">
            {blockedNoOrders.map((b) => (
              <li key={b.phone} className="flex items-center justify-between gap-3 py-2">
                <span className="font-mono">{b.phone}</span>
                <span className="flex-1 text-muted">{b.reason}</span>
                <form action={unblockPhoneForm}><input type="hidden" name="phone" value={b.phone} /><button className="btn btn-outline btn-sm">Unblock</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Block a number</h2>
        <BlockForm />
      </section>
    </div>
  );
}
