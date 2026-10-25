import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Deleted orders (in the trash) must not count anywhere: the dashboard banner
 * once showed "1 new order waiting" for a deleted order. Every database
 * function that counts or sums orders has to skip deleted_at — either in its
 * own definition or through a later migration that patches it.
 */
const COUNTING_FUNCTIONS = ['dashboard_stats', 'dashboard_report', 'report_summary', 'report_products', 'order_tab_counts', 'customer_stats', 'customers_list'];

const dir = join(process.cwd(), 'supabase', 'migrations');
const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ file: f, sql: readFileSync(join(dir, f), 'utf8') }));

describe('deleted orders stay out of counts', () => {
  for (const fn of COUNTING_FUNCTIONS) {
    it(`${fn}() skips deleted orders`, () => {
      const touching = migrations.filter((m) => m.sql.includes(`public.${fn}(`));
      expect(touching.length, `no migration defines ${fn}`).toBeGreaterThan(0);
      // The newest migration that creates or patches it must filter deleted orders.
      const last = touching[touching.length - 1]!;
      expect(last.sql, `${last.file} must keep deleted orders out of ${fn}()`).toMatch(/deleted_at is null/);
    });
  }
});
