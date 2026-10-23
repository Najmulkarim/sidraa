import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteZone } from '@/actions/admin-settings';
import { CourierSettingsForm, type CourierSettingsView } from '@/components/admin/CourierSettingsForm';
import { LogoUploader } from '@/components/admin/LogoUploader';
import { MarketingSettingsForm, type MarketingView } from '@/components/admin/MarketingSettingsForm';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { StaffManager, type StaffMember } from '@/components/admin/StaffManager';
import { ZoneForm } from '@/components/admin/ZoneForm';
import { requireAdmin } from '@/lib/auth';
import { SITE_URL } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { isPermission, SETTINGS_TABS, type Permission, type SettingsTab } from '@/lib/permissions';
import type { DeliveryZone, StoreSettings } from '@/lib/types';

export const metadata: Metadata = { title: 'Settings' };

/** Global settings, one tab per area. Each tab needs its own permission. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ supabase, can, user }, sp] = await Promise.all([requireAdmin(), searchParams]);
  const tabs = SETTINGS_TABS.filter((t) => can.has(t.need));
  if (tabs.length === 0) redirect('/admin?denied=store_settings');
  const tab: SettingsTab = (tabs.find((t) => t.key === sp.tab) ?? tabs[0]!).key;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Changes apply to the shop within seconds.</p>
      </header>

      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === tabs[0]!.key ? '/admin/settings' : `/admin/settings?tab=${t.key}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold ${t.key === tab ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white' : 'text-ink hover:bg-soft'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'store' && <StoreTab supabase={supabase} />}
      {tab === 'delivery' && <DeliveryTab supabase={supabase} />}
      {tab === 'courier' && <CourierTab supabase={supabase} />}
      {tab === 'facebook' && <FacebookTab supabase={supabase} />}
      {tab === 'staff' && <StaffTab supabase={supabase} meId={user.id} />}
    </div>
  );
}

type Db = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

async function StoreTab({ supabase }: { supabase: Db }) {
  const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single();
  const s = data as StoreSettings;
  return (
    <div className="space-y-6">
      <LogoUploader path={s.logo_path} />
      <SettingsForm settings={s} />
    </div>
  );
}

async function DeliveryTab({ supabase }: { supabase: Db }) {
  const { data: zones } = await supabase.from('delivery_zones').select('*').order('sort_order');
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Delivery areas &amp; charges</h2>
        <p className="text-sm text-muted">Customers pick one at checkout. Charges are applied by the server; a deactivated area disappears from checkout but stays on past orders.</p>
      </div>
      <div className="divide-y divide-line">
        {((zones ?? []) as DeliveryZone[]).map((z) => (
          <div key={z.id} className="space-y-2 py-4">
            <ZoneForm key={z.id} zone={z} />
            <form action={deleteZone} className="text-right">
              <input type="hidden" name="id" value={z.id} />
              <button className="text-xs text-bad underline">Delete area</button>
            </form>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-paper p-4">
        <h3 className="mb-2 text-sm font-semibold">Add an area</h3>
        <ZoneForm />
      </div>
    </section>
  );
}

async function CourierTab({ supabase }: { supabase: Db }) {
  const { data, error } = await supabase.rpc('get_courier_settings');
  if (error || !data) return <p className="card p-5 text-sm text-bad">Could not load the courier settings.</p>;
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-soft px-4 py-3 text-[13px] text-muted">
        Keys are stored in a table no browser can read. This page only shows the last four characters. Parcels are booked from the Orders page (Send) — the amount to collect is always the order&apos;s due amount from the database.
      </p>
      <CourierSettingsForm settings={data as CourierSettingsView} siteUrl={SITE_URL} />
    </div>
  );
}

async function FacebookTab({ supabase }: { supabase: Db }) {
  const [{ data, error }, { data: events }] = await Promise.all([
    supabase.rpc('get_marketing_settings'),
    supabase.from('capi_events').select('id, event_name, event_id, ok, response, created_at').order('created_at', { ascending: false }).limit(15),
  ]);
  if (error || !data) return <p className="card p-5 text-sm text-bad">Could not load the Facebook settings.</p>;
  const log = (events ?? []) as { id: number; event_name: string; event_id: string; ok: boolean; response: string | null; created_at: string }[];
  return (
    <div className="space-y-6">
      <MarketingSettingsForm settings={data as MarketingView} siteUrl={SITE_URL} />
      <section className="card overflow-hidden">
        <h2 className="p-5 pb-3 font-semibold">Recent Conversions API events</h2>
        {log.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">None yet. They appear here after the next order once the Conversions API is on.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Event</th><th>Order</th><th>Result</th></tr></thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(e.created_at)}</td>
                    <td>{e.event_name}</td>
                    <td className="font-mono">{e.event_id}</td>
                    <td>{e.ok ? <span className="badge badge-ok">Accepted</span> : <span className="badge badge-bad" title={e.response ?? ''}>Rejected</span>}</td>
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

async function StaffTab({ supabase, meId }: { supabase: Db; meId: string }) {
  const [{ data: staff, error }, { data: rows }] = await Promise.all([
    supabase.rpc('staff_list'),
    supabase.from('role_permissions').select('role, permission'),
  ]);
  if (error) return <p className="card p-5 text-sm text-bad">Could not load staff.</p>;
  const matrix: Record<'manager' | 'support', Permission[]> = { manager: [], support: [] };
  for (const r of (rows ?? []) as { role: string; permission: string }[]) {
    if ((r.role === 'manager' || r.role === 'support') && isPermission(r.permission)) matrix[r.role].push(r.permission);
  }
  return <StaffManager staff={(staff ?? []) as StaffMember[]} meId={meId} matrix={matrix} />;
}
