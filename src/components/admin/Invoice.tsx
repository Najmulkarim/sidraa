import { imageUrl } from '@/lib/env';
import { formatDateTime, formatTaka, toNumber } from '@/lib/format';
import { formatBdPhone } from '@/lib/phone';
import type { InvoiceTemplate, Storefront } from '@/lib/storefront';
import type { Order, OrderItem, StoreSettings } from '@/lib/types';

type O = Order & { items: OrderItem[] };
type Props = { order: O; settings: StoreSettings; sf: Storefront; template: InvoiceTemplate };

const WALLET: Record<string, string> = { bkash: 'bKash', nagad: 'Nagad' };

/** Shared facts every design prints. */
function facts(o: O, s: StoreSettings, sf: Storefront) {
  const due = Math.max(0, toNumber(o.total) - toNumber(o.paid_amount));
  const paidBy = o.payment_status === 'paid' && WALLET[o.payment_method] ? `Paid by ${WALLET[o.payment_method]}` : null;
  return {
    due,
    paidBy,
    logo: sf.invoice.show_logo ? imageUrl(s.logo_path) : null,
    place: [o.area, o.district].filter(Boolean).join(', '),
    footer: sf.invoice.footer || s.cod_terms,
    title: sf.invoice.title || 'Invoice',
    contact: [s.phone, s.email].filter(Boolean).join(' · '),
  };
}

function Items({ o, sku, tone }: { o: O; sku: boolean; tone: 'line' | 'soft' | 'bold' }) {
  const head = tone === 'bold' ? 'bg-black text-white' : tone === 'soft' ? 'border-b border-gray-300 text-gray-500' : 'border-y border-black';
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className={`text-left ${head}`}>
          <th className="px-2 py-2 font-semibold">Item</th>
          {sku && <th className="px-2 font-semibold">SKU</th>}
          <th className="px-2 text-right font-semibold">Qty</th>
          <th className="px-2 text-right font-semibold">Price</th>
          <th className="px-2 text-right font-semibold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {o.items.map((i) => (
          <tr key={i.id} className="border-b border-gray-200">
            <td className="px-2 py-2">
              {i.product_name}
              {i.variant_label ? <span className="text-gray-500"> — {i.variant_label}</span> : null}
              {i.backorder === 'preorder' && <span className="ml-1 text-[11px] font-bold uppercase">(Pre-order)</span>}
            </td>
            {sku && <td className="px-2 font-mono text-[11px]">{i.sku}</td>}
            <td className="px-2 text-right">{i.quantity}</td>
            <td className="px-2 text-right">{formatTaka(i.unit_price)}</td>
            <td className="px-2 text-right">{formatTaka(i.line_total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ o, f, strong }: { o: O; f: ReturnType<typeof facts>; strong?: string }) {
  return (
    <dl className="ml-auto mt-3 w-64 space-y-1 text-[13px]">
      <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
      {toNumber(o.discount) > 0 && <div className="flex justify-between"><dt>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</dt><dd>− {formatTaka(o.discount)}</dd></div>}
      <div className="flex justify-between"><dt>Delivery ({o.zone_name})</dt><dd>{formatTaka(o.delivery_charge)}</dd></div>
      <div className="flex justify-between border-t border-black pt-1 font-bold"><dt>Total</dt><dd>{formatTaka(o.total)}</dd></div>
      {toNumber(o.paid_amount) > 0 && <div className="flex justify-between"><dt>{f.paidBy ?? 'Paid'}</dt><dd>− {formatTaka(o.paid_amount)}</dd></div>}
      <div className={`flex justify-between font-bold ${strong ?? ''}`}><dt>Collect cash</dt><dd>{formatTaka(f.due)}</dd></div>
    </dl>
  );
}

function Customer({ o, f }: { o: O; f: ReturnType<typeof facts> }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Deliver to</p>
      <p className="text-[15px] font-semibold">{o.customer_name}</p>
      <p className="font-mono text-[14px]">{formatBdPhone(o.customer_phone)}</p>
      <p className="whitespace-pre-line text-[13px]">{o.address}</p>
      {f.place && <p className="text-[13px]">{f.place}</p>}
    </div>
  );
}

/** One printed invoice in the chosen design (Settings → Storefront → Invoice). */
export function Invoice({ order: o, settings: s, sf, template }: Props) {
  const f = facts(o, s, sf);
  const sku = sf.invoice.show_sku;

  if (template === 'thermal') {
    return (
      // Printed sizes are in vw/em: vw follows the page, so the receipt looks the same at any print scale.
      // The side space (14vw of 80 mm, about 11 mm) keeps prices inside what the POS printer can reach.
      // The screen uses the same proportions, so what you see is what prints.
      <article className="mx-auto w-[80mm] break-after-page bg-white px-[11.2mm] py-[1.6mm] font-sans text-[9.07px] leading-snug text-black last:break-after-auto print:w-full print:px-[14vw] print:py-[2vw] print:text-[3vw]">
        <div className="text-center">
          {f.logo ? <img src={f.logo} alt={s.store_name} className="mx-auto mb-[0.4em] max-h-[3.2em] grayscale" /> : <p className="text-[1.4em] font-bold">{s.store_name}</p>}
          {f.contact && <p className="text-[0.85em]">{f.contact}</p>}
        </div>
        <div className="mt-[0.5em] flex items-baseline justify-between border-y border-black py-[0.35em]">
          <b className="whitespace-nowrap font-mono">{o.public_ref}</b>
          <span className="whitespace-nowrap text-[0.9em]">{formatDateTime(o.created_at)}</span>
        </div>
        <div className="mt-[0.6em]">
          <p className="font-bold">{o.customer_name}</p>
          <p className="font-mono font-bold">{formatBdPhone(o.customer_phone)}</p>
          <p className="whitespace-pre-line">{o.address}{f.place ? `, ${f.place}` : ''}</p>
        </div>
        <div className="my-[0.6em] border-t border-dashed border-black" />
        {o.items.map((i) => (
          <div key={i.id} className="mb-[0.4em]">
            <p className="font-medium">{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''}</p>
            <p className="flex justify-between whitespace-nowrap"><span>{i.quantity} × {formatTaka(i.unit_price)}</span><span>{formatTaka(i.line_total)}</span></p>
          </div>
        ))}
        <div className="my-[0.6em] border-t border-dashed border-black" />
        <p className="flex justify-between"><span>Subtotal</span><span>{formatTaka(o.subtotal)}</span></p>
        {toNumber(o.discount) > 0 && <p className="flex justify-between"><span>Discount</span><span>−{formatTaka(o.discount)}</span></p>}
        <p className="flex justify-between"><span>Delivery</span><span>{formatTaka(o.delivery_charge)}</span></p>
        <p className="flex justify-between font-bold"><span>Total</span><span>{formatTaka(o.total)}</span></p>
        {f.paidBy && <p className="flex justify-between"><span>{f.paidBy}</span><span>−{formatTaka(o.paid_amount)}</span></p>}
        <p className="mt-[0.5em] flex items-baseline justify-between border-y-2 border-black py-[0.35em] font-bold whitespace-nowrap"><span>COLLECT</span><span className="text-[1.3em]">{formatTaka(f.due)}</span></p>
      </article>
    );
  }

  if (template === 'compact') {
    return (
      <article className="mx-auto mb-4 h-[140mm] max-w-[190mm] overflow-hidden border border-dashed border-gray-400 bg-white p-5 text-black [break-inside:avoid] print:mb-[4mm] print:border-gray-300">
        <header className="flex items-start justify-between border-b border-black pb-2">
          <div className="flex items-center gap-2">
            {f.logo && <img src={f.logo} alt="" className="max-h-8" />}
            <div><p className="font-bold">{s.store_name}</p>{f.contact && <p className="text-[11px]">{f.contact}</p>}</div>
          </div>
          <div className="text-right"><p className="font-mono text-[16px] font-bold">{o.public_ref}</p><p className="text-[11px]">{formatDateTime(o.created_at)}</p></div>
        </header>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-4">
          <Customer o={o} f={f} />
          <div className="text-right"><p className="text-[11px] font-bold uppercase">Collect cash</p><p className="text-[26px] font-extrabold leading-none">{formatTaka(f.due)}</p>{f.paidBy && <p className="text-[11px]">{f.paidBy}</p>}</div>
        </div>
        <ul className="mt-3 space-y-0.5 border-t border-gray-300 pt-2 text-[12.5px]">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ''}{sku ? ` · ${i.sku}` : ''}</span><span>{formatTaka(i.line_total)}</span></li>
          ))}
        </ul>
        <p className="mt-2 text-right text-[12.5px]">Delivery {formatTaka(o.delivery_charge)} · <b>Total {formatTaka(o.total)}</b></p>
        {o.note && <p className="mt-2 text-[12px]"><b>Note:</b> {o.note}</p>}
      </article>
    );
  }

  if (template === 'modern') {
    return (
      <article className="mx-auto max-w-[200mm] break-after-page overflow-hidden rounded-xl bg-white text-black shadow-sm print:rounded-none print:shadow-none">
        <header className="flex items-center justify-between bg-[var(--brand)] px-8 py-6 text-white [print-color-adjust:exact]">
          <div className="flex items-center gap-3">
            {f.logo && <span className="rounded-lg bg-white p-1.5"><img src={f.logo} alt="" className="max-h-10" /></span>}
            <div><p className="text-[20px] font-bold">{s.store_name}</p>{f.contact && <p className="text-[12px] opacity-90">{f.contact}</p>}</div>
          </div>
          <div className="text-right">
            <p className="text-[12px] uppercase tracking-[0.2em] opacity-90">{f.title}</p>
            <p className="font-mono text-[22px] font-bold">{o.public_ref}</p>
            <p className="text-[12px] opacity-90">{formatDateTime(o.created_at)}</p>
          </div>
        </header>
        <div className="space-y-5 p-8">
          <div className="grid grid-cols-[1fr_auto] gap-6">
            <Customer o={o} f={f} />
            <div className="rounded-xl border-2 border-[var(--brand)] px-5 py-3 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider">Collect cash</p>
              <p className="text-[30px] font-extrabold leading-tight text-[var(--brand)]">{formatTaka(f.due)}</p>
              {f.paidBy && <p className="text-[12px]">{f.paidBy}</p>}
            </div>
          </div>
          <Items o={o} sku={sku} tone="bold" />
          <Totals o={o} f={f} strong="text-[var(--brand)]" />
          {o.note && <p className="rounded-lg bg-gray-100 p-3 text-[13px]"><b>Note:</b> {o.note}</p>}
          <p className="border-t border-gray-200 pt-3 text-center text-[12px] text-gray-600">{f.footer}</p>
        </div>
      </article>
    );
  }

  if (template === 'minimal') {
    return (
      <article className="mx-auto max-w-[190mm] break-after-page bg-white p-10 text-black">
        <header className="flex items-end justify-between">
          <div>{f.logo ? <img src={f.logo} alt={s.store_name} className="max-h-10" /> : <p className="text-[22px] font-light tracking-wide">{s.store_name}</p>}</div>
          <p className="text-[30px] font-extralight uppercase tracking-[0.25em] text-gray-400">{f.title}</p>
        </header>
        <div className="mt-8 grid grid-cols-3 gap-6 text-[13px]">
          <Customer o={o} f={f} />
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Order</p><p className="font-mono">{o.public_ref}</p><p>{formatDateTime(o.created_at)}</p></div>
          <div className="text-right"><p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Collect cash</p><p className="text-[24px] font-semibold">{formatTaka(f.due)}</p></div>
        </div>
        <div className="mt-8"><Items o={o} sku={sku} tone="soft" /></div>
        <Totals o={o} f={f} />
        <p className="mt-10 text-[12px] text-gray-500">{f.footer}</p>
        {f.contact && <p className="text-[12px] text-gray-500">{s.store_name} · {f.contact}</p>}
      </article>
    );
  }

  // Classic
  return (
    <article className="mx-auto max-w-2xl break-after-page bg-white p-8 text-black print:p-0">
      <header className="flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          {f.logo && <img src={f.logo} alt="" className="max-h-10" />}
          <div><p className="text-2xl font-bold tracking-tight">{s.store_name}</p>{f.contact && <p className="text-sm">{f.contact}</p>}</div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest">{f.title}</p>
          <p className="font-mono text-xl font-bold">{o.public_ref}</p>
          <p className="text-xs">{formatDateTime(o.created_at)}</p>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-5">
        <Customer o={o} f={f} />
        <div className="text-right">
          <p className="text-xs font-bold uppercase">Collect cash</p>
          <p className="text-3xl font-bold">{formatTaka(f.due)}</p>
          {f.paidBy && <p className="text-xs">{f.paidBy} {formatTaka(o.paid_amount)}</p>}
          <p className="text-xs">{o.zone_name}</p>
        </div>
      </section>
      <Items o={o} sku={sku} tone="line" />
      <Totals o={o} f={f} />
      {o.note && <p className="mt-6 border border-black p-3 text-sm"><strong>Note:</strong> {o.note}</p>}
      <p className="mt-8 text-xs">{f.footer}</p>
    </article>
  );
}
