/**
 * Accounting, order by order: what each order counted in the period added to
 * income and cost — the same rules as the profit & loss statement
 * (accounting_pnl), so the rows add up to its totals.
 */
import { codFeeAt, rateFor, type FeeRate } from './courier-insight';

export type CostItem = { id: string; product_name: string; variant_label: string | null; quantity: number; unit_cost: number | string | null };

export type CostOrder = {
  id: string;
  public_ref: string;
  status: 'delivered' | 'returned';
  /** When it counted: delivered_at for a delivered order, returned_at for a return. */
  counted_at: string;
  total: number | string;
  paid_amount: number | string;
  paid_before_delivery: number | string | null;
  delivery_charge: number | string;
  courier: string | null;
  courier_consignment_id: string | null;
  courier_charge: number | string | null;
  courier_cod_fee: number | string | null;
  courier_sent_at: string | null;
  items: CostItem[];
};

export type CostRow = CostOrder & {
  income: number;
  productCost: number;
  /** Pieces with no cost price yet (their cost counts as 0). */
  missingCost: number;
  courierCharge: number;
  /** The courier charge is a guess: none recorded on a delivered courier order. */
  chargeMissing: boolean;
  codFee: number;
  codFromRate: boolean;
  net: number;
};

const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;

export function costRow(o: CostOrder, rates: Record<string, FeeRate[]>): CostRow {
  const total = n(o.total) ?? 0;
  const paid = n(o.paid_amount) ?? 0;
  const byCourier = !!(o.courier && o.courier_consignment_id);
  const rate = byCourier ? rateFor(rates[o.courier!] ?? [], o.courier_sent_at) : 0;
  const savedCod = n(o.courier_cod_fee);
  let income = 0, productCost = 0, missingCost = 0, courierCharge = 0, codFee = 0, chargeMissing = false, codFromRate = false;

  if (o.status === 'delivered') {
    income = total - Math.max(total - paid, 0);
    for (const i of o.items) {
      const c = n(i.unit_cost);
      if (c === null) missingCost += i.quantity;
      else productCost += i.quantity * c;
    }
    if (byCourier) {
      const charge = n(o.courier_charge);
      courierCharge = charge ?? 0;
      chargeMissing = charge === null;
      const cash = Math.max(Math.min(paid, total) - (n(o.paid_before_delivery) ?? 0), 0);
      codFee = savedCod ?? codFeeAt(cash, rate);
      codFromRate = savedCod === null && cash > 0;
    }
  } else {
    // A return: only what the customer paid at the door is income; its delivery cost is a cost.
    income = paid;
    courierCharge = n(o.courier_charge) ?? n(o.delivery_charge) ?? 0;
    if (byCourier && paid > 0) {
      codFee = savedCod ?? codFeeAt(paid, rate);
      codFromRate = savedCod === null;
    }
  }
  income = r2(income); productCost = r2(productCost); courierCharge = r2(courierCharge); codFee = r2(codFee);
  return { ...o, income, productCost, missingCost, courierCharge, chargeMissing, codFee, codFromRate, net: r2(income - productCost - courierCharge - codFee) };
}

export function costTotals(rows: CostRow[]) {
  const sum = (f: (r: CostRow) => number) => r2(rows.reduce((a, r) => a + f(r), 0));
  return { income: sum((r) => r.income), productCost: sum((r) => r.productCost), courierCharge: sum((r) => r.courierCharge), codFee: sum((r) => r.codFee), net: sum((r) => r.net) };
}
