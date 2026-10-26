import { describe, expect, it } from 'vitest';
import { autoGroup, expenseSchema, pnlTotals } from '@/lib/accounting';
import { resolveRange } from '@/lib/format';

describe('profit & loss totals', () => {
  it('gross = income − cost of goods; net = gross − expenses; margins on income', () => {
    expect(pnlTotals({ income: 10_000, cogs: 6_000, expenses_total: 2_500 })).toEqual({ gross: 4_000, net: 1_500, grossMargin: 40, netMargin: 15 });
  });
  it('shows a loss and keeps paisa exact', () => {
    expect(pnlTotals({ income: 100.1, cogs: 0.2, expenses_total: 150 })).toMatchObject({ gross: 99.9, net: -50.1 });
  });
  it('has no margin without income', () => {
    expect(pnlTotals({ income: 0, cogs: 0, expenses_total: 500 })).toEqual({ gross: 0, net: -500, grossMargin: null, netMargin: null });
  });
  it('accepts numeric strings from the database', () => {
    expect(pnlTotals({ income: '1200.50' as unknown as number, cogs: '700.25' as unknown as number, expenses_total: '0' as unknown as number }).gross).toBe(500.25);
  });
});

describe('periods', () => {
  // 26 Oct 2026 is a Monday; the Bangladesh week starts on Saturday 24 Oct.
  const now = new Date('2026-10-26T06:00:00Z');
  it('this week / last week start on Saturday', () => {
    expect(resolveRange('this-week', undefined, undefined, now)).toMatchObject({ from: '2026-10-24', to: '2026-10-26' });
    expect(resolveRange('last-week', undefined, undefined, now)).toMatchObject({ from: '2026-10-17', to: '2026-10-23' });
  });
  it('last year is the whole calendar year', () => {
    expect(resolveRange('last-year', undefined, undefined, now)).toMatchObject({ from: '2025-01-01', to: '2025-12-31' });
  });
  it('custom ranges may be longer when allowed', () => {
    expect(resolveRange('custom', '2020-01-01', '2026-10-26', now).from).toBe('2025-10-25');
    expect(resolveRange('custom', '2020-01-01', '2026-10-26', now, 3650).from).toBe('2020-01-01');
  });
  it('groups by day, week, month or year from the length', () => {
    expect([autoGroup(1), autoGroup(31), autoGroup(90), autoGroup(365), autoGroup(1500)]).toEqual(['day', 'day', 'week', 'month', 'year']);
  });
});

describe('expenses', () => {
  it('needs a date, a known category and a positive amount', () => {
    expect(expenseSchema.safeParse({ spentOn: '2026-10-26', category: 'advertising', amount: '1500' }).success).toBe(true);
    expect(expenseSchema.safeParse({ spentOn: '2026-10-26', category: 'stock', amount: '1500' }).success).toBe(false);
    expect(expenseSchema.safeParse({ spentOn: '2026-10-26', category: 'salary', amount: '0' }).success).toBe(false);
    expect(expenseSchema.safeParse({ spentOn: '', category: 'salary', amount: '10' }).success).toBe(false);
  });
});
