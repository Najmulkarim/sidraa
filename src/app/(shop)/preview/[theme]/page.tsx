import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HomeView } from '@/components/shop/home/HomeView';
import { requirePermission } from '@/lib/auth';
import { isTheme, THEME_INFO } from '@/lib/home-sections';

export const metadata: Metadata = { title: 'Theme preview', robots: { index: false, follow: false } };

/** Staff-only preview of a home theme before it goes live (the header and footer stay the live theme's). */
export default async function ThemePreviewPage({ params }: { params: Promise<{ theme: string }> }) {
  const [{ theme }] = await Promise.all([params, requirePermission('store_settings')]);
  if (!isTheme(theme)) notFound();
  return (
    <div data-theme={theme}>
      <div className="sticky top-16 z-20 bg-night text-white md:top-[76px]">
        <p className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
          <span>Preview of <b>{THEME_INFO[theme].name}</b> — visitors still see your live theme.</span>
          <Link href={`/admin/homepage?theme=${theme}`} className="font-semibold text-accent underline">Back to Homepage settings</Link>
        </p>
      </div>
      <HomeView theme={theme} />
    </div>
  );
}
