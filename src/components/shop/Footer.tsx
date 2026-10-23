import Link from 'next/link';
import type { Category, StoreSettings } from '@/lib/types';
import { Icon } from '../icons';
import { Logo } from './Header';

const SOCIAL_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

export function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const social = Object.entries(settings.social ?? {}).filter(([k, v]) => SOCIAL_LABEL[k] && typeof v === 'string' && v.startsWith('https://'));
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-night text-white/80">
      {/* Phones: brand and contact span the width, the two link lists sit side by side. */}
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 space-y-4 lg:col-span-1">
          <Logo settings={settings} variant="dark" className="h-12" />
          <p className="max-w-xs text-[13px] leading-relaxed text-white/65">
            Your destination for everyday fashion. Order in a minute and pay in cash when it reaches your door.
          </p>
          {social.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {social.map(([k, v]) => (
                <li key={k}>
                  <a href={v as string} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs hover:border-accent hover:text-white">{SOCIAL_LABEL[k]}</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Shop</p>
          <ul className="space-y-2.5 text-[13px]">
            <li><Link href="/products" className="hover:text-accent">All products</Link></li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}><Link href={`/category/${c.slug}`} className="hover:text-accent">{c.name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Customer service</p>
          <ul className="space-y-2.5 text-[13px]">
            <li><Link href="/track" className="hover:text-accent">Track your order</Link></li>
            <li><Link href="/info/delivery" className="hover:text-accent">Delivery &amp; cash on delivery</Link></li>
            <li><Link href="/info/returns" className="hover:text-accent">Returns &amp; exchange</Link></li>
            <li><Link href="/info/privacy" className="hover:text-accent">Privacy policy</Link></li>
            <li><Link href="/info/terms" className="hover:text-accent">Terms &amp; conditions</Link></li>
          </ul>
        </div>

        <div className="col-span-2 lg:col-span-1">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-white">Contact us</p>
          <ul className="space-y-3 text-[13px]">
            {settings.phone && (
              <li className="flex items-center gap-2.5"><Icon name="phone" size={16} className="text-accent" /><span className="select-all">{settings.phone}</span></li>
            )}
            {settings.email && (
              <li className="flex items-center gap-2.5"><Icon name="mail" size={16} className="text-accent" /><span className="select-all">{settings.email}</span></li>
            )}
            {settings.address && (
              <li className="flex items-start gap-2.5"><Icon name="pin" size={16} className="mt-0.5 shrink-0 text-accent" /><span>{settings.address}</span></li>
            )}
            {!settings.phone && !settings.email && !settings.address && <li className="text-white/55">Contact details are added in Admin → Settings.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-[11.5px] text-white/50">
        © {year} {settings.store_name}. All prices in Bangladeshi Taka (৳).
      </div>
    </footer>
  );
}
