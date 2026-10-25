import type { Metadata } from 'next';
import { HomeBuilder, type PickCategory, type PickProduct } from '@/components/admin/HomeBuilder';
import { ThemePicker } from '@/components/admin/ThemePicker';
import { requirePermission } from '@/lib/auth';
import { isTheme, parseSettings, SECTION_TYPES, THEME_INFO, type HomeSection, type SectionType, type ThemeKey } from '@/lib/home-sections';

export const metadata: Metadata = { title: 'Homepage' };

type Row = { id: string; type: string; title: string | null; subtitle: string | null; enabled: boolean; sort_order: number; settings: unknown };
type ProductRow = { id: string; sku: string; name: string; status: string; images: { storage_path: string; sort_order: number }[] };

/** Themes (one click to go live) and each theme's sections: on/off, order, headings, pictures and products. */
export default async function HomepageAdminPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('store_settings'), searchParams]);
  const { data: s } = await supabase.from('store_settings').select('home_theme').eq('id', 1).maybeSingle<{ home_theme: string }>();
  const live: ThemeKey = isTheme(s?.home_theme) ? s.home_theme : 'luxora';
  const editing: ThemeKey = isTheme(sp.theme) ? sp.theme : live;

  const [{ data: rows, error }, { data: cats }, { data: prods }] = await Promise.all([
    supabase.from('home_sections').select('id, type, title, subtitle, enabled, sort_order, settings').eq('theme', editing).order('sort_order').order('created_at'),
    supabase.from('categories').select('id, name').order('sort_order').order('name'),
    supabase.from('products').select('id, sku, name, status, images:product_images(storage_path, sort_order)').neq('status', 'archived').order('name').limit(2000),
  ]);

  const sections: HomeSection[] = ((rows ?? []) as Row[])
    .filter((r): r is Row & { type: SectionType } => (SECTION_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ id: r.id, type: r.type, title: r.title, subtitle: r.subtitle, enabled: r.enabled, sort_order: r.sort_order, settings: parseSettings(r.type, r.settings) }));
  const products: PickProduct[] = ((prods ?? []) as ProductRow[]).map((p) => ({
    id: p.id, sku: p.sku, name: p.name, status: p.status,
    image: [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Homepage</h1>
          <p className="text-sm text-muted">Pick a theme and press <b>Activate</b> to make it your home page. Each theme keeps its own sections, so switching never loses your work.</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View live home page</a>
      </header>

      <ThemePicker live={live} editing={editing} />

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-5">
        <h2 className="text-lg font-bold">
          Sections of <span className="text-brand-ink">{THEME_INFO[editing].name}</span>
          {editing === live ? <span className="badge badge-ok ml-2 align-middle">Live</span> : <span className="badge ml-2 align-middle">Not live</span>}
        </h2>
        <p className="text-[13px] text-muted">Switch on/off, drag ⠿ or use the arrows to reorder, open one to edit.</p>
      </div>
      {error ? (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the sections. Run the latest database update in Supabase, then reload.</p>
      ) : (
        <HomeBuilder key={editing} theme={editing} sections={sections} products={products} categories={(cats ?? []) as PickCategory[]} />
      )}
    </div>
  );
}
