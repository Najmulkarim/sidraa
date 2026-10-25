import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeView } from '@/components/shop/home/HomeView';
import { isTheme, THEME_INFO, type ThemeKey } from '@/lib/home-sections';

export const metadata: Metadata = { title: 'Theme preview', robots: { index: false, follow: false } };

/** Preview of a home theme before it goes live (the layout checks the staff login). ?embed=1: inside the Homepage editor, without the top bar. */
export default async function ThemePreviewPage({ params, searchParams }: { params: Promise<{ theme: string }>; searchParams: Promise<{ embed?: string }> }) {
  const [{ theme }, { embed }] = await Promise.all([params, searchParams]);
  const t = (isTheme(theme) ? theme : 'luxora') as ThemeKey;
  return (
    <>
      {/* Links open in a new tab: the shop pages themselves may not be framed. */}
      {embed && <base target="_blank" />}
      {!embed && (
        <div className="bg-night text-white">
          <p className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
            <span>Preview of <b>{THEME_INFO[t].name}</b> — visitors see your live theme until you activate this one.</span>
            <Link href={`/admin/homepage?theme=${t}#sections`} className="font-semibold text-accent underline">Back to Homepage settings</Link>
          </p>
        </div>
      )}
      <HomeView theme={t} anchors />
    </>
  );
}
