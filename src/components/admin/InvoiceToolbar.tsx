import Link from 'next/link';
import { INVOICE_TEMPLATES, type InvoiceTemplate } from '@/lib/storefront';
import { PrintButton } from './PrintButton';

/** Above printed invoices (hidden when printing): switch design for this print, then Print. */
export function InvoiceToolbar({ current, hrefFor, count, back }: { current: InvoiceTemplate; hrefFor: (t: InvoiceTemplate) => string; count?: number; back?: string }) {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-4xl flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
      {back && <Link href={back} className="mr-1 text-sm text-muted hover:text-ink">← Orders</Link>}
      <span className="text-[13px] font-semibold">Design:</span>
      {(Object.keys(INVOICE_TEMPLATES) as InvoiceTemplate[]).map((t) => (
        <Link key={t} href={hrefFor(t)} aria-current={t === current ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${t === current ? 'bg-night text-white' : 'ring-1 ring-line hover:ring-brand'}`}>
          {INVOICE_TEMPLATES[t].name}
        </Link>
      ))}
      <span className="ml-auto flex items-center gap-3">
        {count !== undefined && <span className="text-sm text-muted">{count} invoice{count === 1 ? '' : 's'}</span>}
        <PrintButton back={back} />
      </span>
      {/* A POS printer needs the paper size set to its roll width. Both sizes are required: "80mm auto" is invalid and browsers ignore it. */}
      {current === 'thermal' && <style>{'@media print { @page { size: 80mm 210mm; margin: 0; } }'}</style>}
      {current === 'compact' && <style>{'@media print { @page { size: A4; margin: 8mm; } }'}</style>}
    </div>
  );
}
