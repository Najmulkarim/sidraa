import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeView, type SectionDraft } from '@/components/shop/home/HomeView';
import { isTheme, THEME_INFO, type ThemeKey } from '@/lib/home-sections';

/** ?d=…: the section being edited, unsaved (base64url JSON from the Homepage editor). */
function readDraft(d: string | undefined): SectionDraft | null {
  if (!d || d.length > 30_000) return null;
  try {
    const v = JSON.parse(Buffer.from(d, 'base64url').toString('utf8')) as Partial<SectionDraft>;
    if (typeof v.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(v.id)) return null;
    const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.slice(0, 600) : null);
    return { id: v.id, title: text(v.title), subtitle: text(v.subtitle), settings: v.settings ?? {} };
  } catch {
    return null;
  }
}

export const metadata: Metadata = { title: 'Theme preview', robots: { index: false, follow: false } };

/** Preview of a home theme before it goes live (the layout checks the staff login). ?embed=1: inside the Homepage editor, without the top bar. */
export default async function ThemePreviewPage({ params, searchParams }: { params: Promise<{ theme: string }>; searchParams: Promise<{ embed?: string; d?: string }> }) {
  const [{ theme }, { embed, d }] = await Promise.all([params, searchParams]);
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
      <HomeView theme={t} anchors draft={readDraft(d)} />
    </>
  );
}
