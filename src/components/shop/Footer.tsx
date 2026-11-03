import Link from 'next/link';
import type { Category, StoreSettings } from '@/lib/types';
import { parseStorefront } from '@/lib/storefront';
import { Icon } from '../icons';
import { Logo } from './Header';
import { NewsletterForm } from './NewsletterForm';

// Each network in its own brand colour.
const SOCIAL: Record<string, { label: string; bg: string }> = {
  facebook: { label: 'Facebook', bg: '#1877F2' },
  instagram: { label: 'Instagram', bg: 'linear-gradient(45deg, #F58529, #DD2A7B 45%, #8134AF 75%, #515BD4)' },
  tiktok: { label: 'TikTok', bg: '#000000' },
  youtube: { label: 'YouTube', bg: '#FF0000' },
};

/** White network marks, solid, for the coloured circles. */
function BrandMark({ name }: { name: string }) {
  const svg = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (name === 'facebook') return <svg {...svg} fill="currentColor"><path d="M14 8h3V4.5h-3c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V21h3.5v-6.5h3L17 11h-3.5V8.6c0-.4.2-.6.5-.6Z" /></svg>;
  if (name === 'youtube') return <svg {...svg} fill="currentColor"><path d="M9.5 7.8v8.4l7.2-4.2-7.2-4.2Z" /></svg>;
  if (name === 'tiktok') return <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6" /></svg>;
  return <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" /></svg>;
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="ft-title mb-4 text-[12px] font-semibold uppercase tracking-[0.2em]">{title}</p>
      <ul className="space-y-2.5 text-[14px]">{children}</ul>
    </div>
  );
}

export function Footer({ settings, categories, tone = 'dark' }: { settings: StoreSettings; categories: Category[]; tone?: 'dark' | 'light' }) {
  const light = tone === 'light';
  const show = parseStorefront(settings.storefront).footer;
  const social = Object.entries(settings.social ?? {}).filter(([k, v]) => SOCIAL[k] && typeof v === 'string' && v.startsWith('https://'));
  const year = new Date().getFullYear();
  const hasContact = show.contact && Boolean(settings.phone || settings.email || settings.address);
  // As many columns as there are blocks: a switched-off newsletter or contact leaves no gap.
  const columns = hasContact
    ? show.newsletter ? 'lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.6fr]' : 'lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]'
    : show.newsletter ? 'lg:grid-cols-[1.5fr_1fr_1fr_1.6fr]' : 'lg:grid-cols-[1.6fr_1fr_1fr]';
  const link = light ? 'text-ink/70 transition hover:text-brand' : 'text-white/65 transition hover:text-white';

  return (
    <footer className={`mt-20 ${light ? 'border-t border-line bg-soft text-ink/75 [&_.ft-title]:text-night' : 'bg-night text-white/75 [&_.ft-title]:text-white'}`}>
      {/* Phones: brand and newsletter span the width, link lists two by two. */}
      <div className={`container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 ${columns}`}>
        <div className="col-span-2 space-y-4 lg:col-span-1">
          <Logo settings={settings} variant={light ? 'light' : 'dark'} className="h-12" />
          <p className={`max-w-xs text-[14px] leading-relaxed ${light ? 'text-ink/65' : 'text-white/60'}`}>{settings.tagline ? `${settings.tagline}. ` : ''}Order in a minute and pay in cash when it reaches your door.</p>
          {show.social && social.length > 0 && (
            <ul className="flex gap-2">
              {social.map(([k, v]) => (
                <li key={k}>
                  <a href={v as string} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL[k]!.label} style={{ background: SOCIAL[k]!.bg }} className="grid h-10 w-10 place-items-center rounded-full text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:brightness-110">
                    <BrandMark name={k} />
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

        {hasContact && <Column title="Contact">
          {settings.phone && <li className="flex items-center gap-2"><Icon name="phone" size={15} className="text-accent" /><a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`} className={link}>{settings.phone}</a></li>}
          {settings.email && <li className="flex items-center gap-2"><Icon name="mail" size={15} className="text-accent" /><a href={`mailto:${settings.email}`} className={`${link} break-all`}>{settings.email}</a></li>}
          {settings.address && <li className="flex items-start gap-2"><Icon name="pin" size={15} className="mt-1 shrink-0 text-accent" /><span className={light ? 'text-ink/70' : 'text-white/65'}>{settings.address}</span></li>}
        </Column>}

        {show.newsletter && <div className="col-span-2 lg:col-span-1">
          <p className="ft-title mb-4 text-[12px] font-semibold uppercase tracking-[0.2em]">Newsletter</p>
          <p className={`mb-4 text-[14px] ${light ? 'text-ink/65' : 'text-white/60'}`}>New arrivals, offers and restocks — first, in your inbox.</p>
          <NewsletterForm tone={light ? 'light' : 'dark'} />
        </div>}
      </div>
      <div className={`py-5 text-center text-[12.5px] tracking-wide ${light ? 'bg-night text-white/70' : 'border-t border-white/10 text-white/50'}`}>
        © {year} {settings.store_name}. All rights reserved · Prices in Bangladeshi Taka (৳)
      </div>
    </footer>
  );
}
