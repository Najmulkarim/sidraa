import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Supabase refuses UPDATE and DELETE without a WHERE on API calls ("21000"), so a
 * database function with one fails only when staff use it. A WHERE inside
 * brackets (a subquery) does not count. These ran once in the SQL editor, or were
 * fixed by a later migration.
 */
const KNOWN = ['0011_staff_orders_courier_marketing.sql:pg_temp.t_new_items', '0013_sku_dash_format.sql:public.product_variants', '0014_product_sku_and_variant_suffix.sql:public.product_variants'];

const outsideBrackets = (s: string) => {
  let depth = 0;
  let out = '';
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0) out += c;
  }
  return out;
};

describe('database functions', () => {
  it('have a WHERE on every UPDATE and DELETE', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const bad: string[] = [];
    for (const file of readdirSync(dir).sort()) {
      const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
      for (const m of sql.matchAll(/\b(?:update\s+(?:only\s+)?([\w.]+)(?:\s+\w+)?\s+set\b|delete\s+from\s+([\w.]+))[\s\S]*?;/gi)) {
        if (/\bwhere\b/i.test(outsideBrackets(m[0]))) continue;
        const name = `${file}:${m[1] ?? m[2]}`;
        if (!KNOWN.includes(name)) bad.push(name);
      }
    }
    expect(bad).toEqual([]);
  });
});
