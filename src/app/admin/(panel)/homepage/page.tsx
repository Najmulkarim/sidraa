import type { Metadata } from 'next';
import { HomeBuilder, type PickCategory, type PickProduct } from '@/components/admin/HomeBuilder';
import { requirePermission } from '@/lib/auth';
import { parseSettings, SECTION_TYPES, type HomeSection, type SectionType } from '@/lib/home-sections';

export const metadata: Metadata = { title: 'Homepage' };

type Row = { id: string; type: string; title: string | null; subtitle: string | null; enabled: boolean; sort_order: number; settings: unknown };
type ProductRow = { id: string; sku: string; name: string; status: string; images: { storage_path: string; sort_order: number }[] };

/** Home page builder: sections on/off, order, headings, pictures and products. */
export default async function HomepageAdminPage() {
  const { supabase } = await requirePermission('store_settings');
  const [{ data: rows, error }, { data: cats }, { data: prods }] = await Promise.all([
    supabase.from('home_sections').select('id, type, title, subtitle, enabled, sort_order, settings').order('sort_order').order('created_at'),
    supabase.from('categories').select('id, name').order('sort_order').order('name'),
    supabase.from('products').select('id, sku, name, status, images:product_images(storage_path, sort_order)').neq('status', 'archived').order('name').limit(2000),
  ]);

  const sections: HomeSection[] = ((rows ?? []) as Row[])
    .filter((r): r is Row & { type: SectionType } => (SECTION_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ id: r.id, type: r.type, title: r.title, subtitle: r.subtitle, enabled: r.enabled, sort_order: r.sort_order, settings: parseSettings(r.type, r.settings) }));
  const products: PickProduct[] = ((prods ?? []) as ProductRow[]).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    status: p.status,
    image: [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Homepage</h1>
          <p className="text-sm text-muted">Switch sections on or off, drag ⠿ (or use the arrows) to change their order, and open one to edit it. The shop updates as soon as you save.</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View home page</a>
      </header>
      {error ? (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the sections. Run the database update 0016 in Supabase, then reload.</p>
      ) : (
        <HomeBuilder sections={sections} products={products} categories={(cats ?? []) as PickCategory[]} />
      )}
    </div>
  );
}
