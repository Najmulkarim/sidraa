import Link from 'next/link';
import { Icon } from '../icons';

const DESIGNS = [
  { key: 'showcase', name: 'Showcase', text: 'Big dark top, features with icons, wide photos, features around a photo, photo cards, order box, reviews and contact.' },
  { key: 'story', name: 'Story', text: 'Like a product page at the top (photos, price, Order / WhatsApp / Call buttons), then the product’s story with lists, big poster photos, the order form and a call band.' },
  { key: 'classic', name: 'Simple', text: 'Photos and the offer at the top, ✓ points, the description, questions and the order form. Quick to make.' },
] as const;

/** The landing page designs, each with a live picture filled with one of the shop's products. */
export function LandingDesigns({ used }: { used: Record<string, number> }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Designs</h2>
        <p className="text-sm text-muted">See a design with your own product, then start a page with it. Every word and photo can be changed after.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DESIGNS.map((d) => (
          <article key={d.key} className="card overflow-hidden">
            <a href={`/preview/landing/${d.key}`} target="_blank" rel="noreferrer" className="group relative block h-64 overflow-hidden border-b border-line bg-soft" title="Open the full preview">
              {/* A real page, shrunk: 1280 px wide shown at a quarter size. */}
              <iframe src={`/preview/landing/${d.key}?embed=1`} title={`${d.name} design preview`} loading="lazy" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-[1024px] w-[1280px] origin-top-left scale-[0.25] sm:scale-[0.3]" />
              <span className="absolute inset-0 grid place-items-center bg-night/0 opacity-0 transition group-hover:bg-night/40 group-hover:opacity-100">
                <span className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-ink">Open preview ↗</span>
              </span>
            </a>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">{d.name}{used[d.key] ? <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-brand">{used[d.key]} page{used[d.key] === 1 ? '' : 's'}</span> : null}</h3>
                <p className="text-[13px] text-muted">{d.text}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/landing-pages/new?template=${d.key}`} className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> Use this design</Link>
                <a href={`/preview/landing/${d.key}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"><Icon name="eye" size={14} /> Preview</a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
