import { formatDateTime, formatTaka, toNumber } from '@/lib/format';
import { formatBdPhone } from '@/lib/phone';
import type { Order, OrderItem, StoreSettings } from '@/lib/types';

/** One printable packing slip (A5-ish), shared by single and bulk printing. */
export function PackingSlip({ order: o, settings }: { order: Order & { items: OrderItem[] }; settings: StoreSettings }) {
  const due = toNumber(o.total) - toNumber(o.paid_amount);
  return (
    <article className="mx-auto max-w-2xl break-after-page bg-white p-8 text-black print:p-0">
      <header className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-bold tracking-tight">{settings.store_name}</p>
          {settings.phone && <p className="text-sm">{settings.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest">Packing slip</p>
          <p className="font-mono text-xl font-bold">{o.public_ref}</p>
          <p className="text-xs">{formatDateTime(o.created_at)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-5 text-sm">
        <div>
          <p className="text-xs font-bold uppercase">Deliver to</p>
          <p className="text-base font-semibold">{o.customer_name}</p>
          <p className="font-mono text-base">{formatBdPhone(o.customer_phone)}</p>
          <p className="whitespace-pre-line">{o.address}</p>
          <p>{[o.area, o.district].filter(Boolean).join(', ')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase">Collect cash</p>
          <p className="text-3xl font-bold">{formatTaka(due)}</p>
          {toNumber(o.paid_amount) > 0 && <p className="text-xs">Already paid {formatTaka(o.paid_amount)}</p>}
          <p className="text-xs">{o.zone_name}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black text-left"><th className="py-2">Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-300">
              <td className="py-2">{i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ''}</td>
              <td className="font-mono text-xs">{i.sku}</td>
              <td className="text-right">{i.quantity}</td>
              <td className="text-right">{formatTaka(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 w-56 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{formatTaka(o.delivery_charge)}</dd></div>
        <div className="flex justify-between border-t border-black pt-1 font-bold"><dt>Total</dt><dd>{formatTaka(o.total)}</dd></div>
      </dl>
      {o.note && <p className="mt-6 border border-black p-3 text-sm"><strong>Note:</strong> {o.note}</p>}
      <p className="mt-8 text-xs">{settings.cod_terms}</p>
    </article>
  );
}
