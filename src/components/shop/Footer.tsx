import Link from 'next/link';
import type { Category, StoreSettings } from '@/lib/types';
import { Icon, type IconName } from '../icons';
import { Logo } from './Header';
import { NewsletterForm } from './NewsletterForm';

const SOCIAL: Record<string, { label: string; icon: IconName }> = {
  facebook: { label: 'Facebook', icon: 'facebook' },
  instagram: { label: 'Instagram', icon: 'instagram' },
  tiktok: { label: 'TikTok', icon: 'tiktok' },
  youtube: { label: 'YouTube', icon: 'youtube' },
};

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.22em] text-white">{title}</p>
      <ul className="space-y-2.5 text-[14px]">{children}</ul>
    </div>
  );
}

export function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const social = Object.entries(settings.social ?? {}).filter(([k, v]) => SOCIAL[k] && typeof v === 'string' && v.startsWith('https://'));
  const year = new Date().getFullYear();
  const link = 'text-white/65 transition hover:text-white';

  return (
    <footer className="mt-20 bg-night text-white/75">
      {/* Phones: brand and newsletter span the width, link lists two by two. */}
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.6fr]">
        <div className="col-span-2 space-y-4 lg:col-span-1">
          <Logo settings={settings} variant="dark" className="h-12" />
          <p className="max-w-xs text-[14px] leading-relaxed text-white/60">{settings.tagline ? `${settings.tagline}. ` : ''}Order in a minute and pay in cash when it reaches your door.</p>
          {social.length > 0 && (
            <ul className="flex gap-2">
              {social.map(([k, v]) => (
                <li key={k}>
                  <a href={v as string} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL[k]!.label} className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/25 transition hover:bg-white hover:text-night">
                    <Icon name={SOCIAL[k]!.icon} size={16} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Column title="Shop">
          <li><Link href="/products?sort=new" className={link}>New arrivals</Link></li>
          <li><Link href="/products" className={link}>All products</Link></li>
          {categories.slice(0, 5).map((c) => <li key={c.id}><Link href={`/category/${c.slug}`} className={link}>{c.name}</Link></li>)}
        </Column>

        <Column title="Customer care">
          <li><Link href="/track" className={link}>Track your order</Link></li>
          <li><Link href="/info/delivery" className={link}>Delivery &amp; COD</Link></li>
          <li><Link href="/info/returns" className={link}>Returns &amp; exchange</Link></li>
          <li><Link href="/info/privacy" className={link}>Privacy policy</Link></li>
          <li><Link href="/info/terms" className={link}>Terms &amp; conditions</Link></li>
        </Column>

        <Column title="Contact">
          {settings.phone && <li className="flex items-center gap-2"><Icon name="phone" size={15} className="text-accent" /><a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`} className={link}>{settings.phone}</a></li>}
          {settings.email && <li className="flex items-center gap-2"><Icon name="mail" size={15} className="text-accent" /><a href={`mailto:${settings.email}`} className={`${link} break-all`}>{settings.email}</a></li>}
          {settings.address && <li className="flex items-start gap-2"><Icon name="pin" size={15} className="mt-1 shrink-0 text-accent" /><span className="text-white/65">{settings.address}</span></li>}
          {!settings.phone && !settings.email && !settings.address && <li className="text-white/50">Contact details are added in Admin → Settings.</li>}
        </Column>

        <div className="col-span-2 lg:col-span-1">
          <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.22em] text-white">Newsletter</p>
          <p className="mb-4 text-[14px] text-white/60">New arrivals, offers and restocks — first, in your inbox.</p>
          <NewsletterForm tone="dark" />
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-[12.5px] tracking-wide text-white/50">
        © {year} {settings.store_name}. All rights reserved · Prices in Bangladeshi Taka (৳)
      </div>
    </footer>
  );
}
