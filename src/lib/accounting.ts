import { z } from 'zod';

/** Expense categories (kept in step with the check in supabase/migrations/0033_accounting.sql). */
export const EXPENSE_CATEGORIES = {
  advertising: { label: 'Advertising', hint: 'Facebook, Instagram, Google ads, boosting' },
  salary: { label: 'Salaries & wages', hint: 'Staff pay, bonuses' },
  rent: { label: 'Office / shop rent', hint: 'Rent, service charge' },
  utilities: { label: 'Electricity, internet & phone', hint: 'Bills' },
  courier: { label: 'Courier charges', hint: 'What you pay the courier: delivery, return, COD charge' },
  packaging: { label: 'Packaging', hint: 'Poly bags, boxes, tape, stickers' },
  transport: { label: 'Transport', hint: 'Rickshaw, CNG, fuel' },
  software: { label: 'Software & subscriptions', hint: 'Website, domain, apps' },
  other: { label: 'Other', hint: 'Anything else — write what it was in the note' },
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

export const PAID_VIA = { cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', bank: 'Bank', card: 'Card', other: 'Other' } as const;
export type PaidVia = keyof typeof PAID_VIA;

export const expenseSchema = z.object({
  id: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.uuid().optional()),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date'),
  category: z.enum(CATEGORY_KEYS as [ExpenseCategory, ...ExpenseCategory[]], { error: 'Choose a category' }),
  amount: z.coerce.number({ error: 'Amount must be a number' }).positive('Amount must be more than ৳0').max(99_999_999, 'Amount is too large'),
  paidVia: z.enum(Object.keys(PAID_VIA) as [PaidVia, ...PaidVia[]]).default('cash'),
  reference: z.string().trim().max(80).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
});

export type PnlBucket = { start: string; orders: number; income: number; cogs: number; expenses: number };
export type Pnl = {
  from: string; to: string; group: 'day' | 'week' | 'month' | 'year';
  orders: number; product_sales: number; discounts: number; delivery_income: number; income: number;
  units: number; cogs: number; units_missing_cost: number;
  expenses: Partial<Record<ExpenseCategory, number>>; expenses_total: number;
  returned_orders: number; returned_value: number;
  buckets: PnlBucket[];
};

/** Profit figures from the database totals (all in Taka, rounded to paisa). */
export function pnlTotals(p: Pick<Pnl, 'income' | 'cogs' | 'expenses_total'>) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const gross = r(Number(p.income) - Number(p.cogs));
  const net = r(gross - Number(p.expenses_total));
  const pct = (n: number) => (Number(p.income) > 0 ? Math.round((n / Number(p.income)) * 1000) / 10 : null);
  return { gross, net, grossMargin: pct(gross), netMargin: pct(net) };
}

/** Group a period by day up to a month, by week up to ~4 months, by month up to ~2 years, else by year. */
export function autoGroup(days: number): Pnl['group'] {
  return days <= 31 ? 'day' : days <= 120 ? 'week' : days <= 750 ? 'month' : 'year';
}
