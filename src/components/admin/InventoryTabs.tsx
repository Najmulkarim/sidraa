import Link from 'next/link';
import { Icon, type IconName } from '../icons';

type TabInfo = { key: string; label: string; hint: string; icon: IconName };

/** The Inventory views as one bar: icon, name and a short hint; the open one is lifted and coloured. */
export function InventoryTabs({ tabs, active, counts }: { tabs: readonly TabInfo[]; active: string; counts: Partial<Record<string, number>> }) {
  const tab = active;
  const tabCount = counts;
  return (
    <>
        {/* One bar of views: icon, name and a short hint; the open one is lifted and coloured. */}
        <nav aria-label="Inventory views" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-sm [scrollbar-width:none] print:hidden">
          {tabs.map((t) => {
            const on = t.key === tab;
            const n = tabCount[t.key];
            return (
              <Link key={t.key} href={t.key === 'summary' ? '/admin/inventory' : `/admin/inventory?tab=${t.key}`} aria-current={on ? 'page' : undefined}
                className={`group flex min-w-max flex-1 shrink-0 xl:min-w-[9.5rem] items-center gap-2.5 rounded-xl px-3 py-2 transition ${on ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white shadow-md' : 'text-ink hover:bg-soft'}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${on ? 'bg-white/20 text-white' : 'bg-tint text-brand group-hover:scale-105'}`}>
                  <Icon name={t.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1 text-left leading-tight">
                  <span className="block truncate text-[13px] font-bold">{t.label}</span>
                  <span className={`block truncate text-[11px] ${on ? 'text-white/75' : 'text-muted'}`}>{t.hint}</span>
                </span>
                {n ? (
                  <span className={`shrink-0 rounded-full px-1.5 font-mono text-[11px] font-bold leading-5 ${on ? 'bg-white text-brand' : t.key === 'low' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#fef3c7] text-[#92400e]'}`} title={t.key === 'low' ? 'Low or out of stock' : 'Purchase orders in draft'}>{n}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
  
    </>
  );
}
