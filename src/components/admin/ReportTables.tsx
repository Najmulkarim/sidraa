'use client';

import { useState } from 'react';
import { formatTaka } from '@/lib/format';
import type { ProductRow } from '@/lib/advanced-report';

type Col = { key: keyof ProductRow; label: string; money?: boolean; pct?: boolean };
const COLS: Col[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'units', label: 'Units' },
  { key: 'value', label: 'Ordered', money: true },
  { key: 'deliveredUnits', label: 'Delivered' },
  { key: 'revenue', label: 'Income', money: true },
  { key: 'profit', label: 'Profit', money: true },
  { key: 'margin', label: 'Margin', pct: true },
  { key: 'returnRate', label: 'Return', pct: true },
  { key: 'stock', label: 'Stock' },
];

/** Every product ordered in the period; click a column to sort. Shows 25, then all. */
export function ProductReportTable({ rows, money }: { rows: ProductRow[]; money: boolean }) {
  const [sort, setSort] = useState<{ key: keyof ProductRow; desc: boolean }>({ key: 'value', desc: true });
  const [all, setAll] = useState(false);
  const cols = COLS.filter((c) => money || !(c.money || c.key === 'margin'));
  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const nx = x === null || x === undefined ? -Infinity : typeof x === 'number' ? x : String(x);
    const ny = y === null || y === undefined ? -Infinity : typeof y === 'number' ? y : String(y);
    const c = nx < ny ? -1 : nx > ny ? 1 : 0;
    return sort.desc ? -c : c;
  });
  const shown = all ? sorted : sorted.slice(0, 25);
  const cell = (r: ProductRow, c: Col) => {
    const v = r[c.key];
    if (v === null || v === undefined) return <span className="text-muted">—</span>;
    if (c.money) return formatTaka(Number(v));
    if (c.pct) {
      const p = Number(v);
      const tone = c.key === 'returnRate' ? (p >= 20 ? 'text-bad' : p >= 10 ? 'text-warn' : '') : p < 0 ? 'text-bad' : '';
      return <span className={tone}>{p}%</span>;
    }
    if (c.key === 'stock') return <span className={Number(v) <= 0 ? 'font-semibold text-bad' : Number(v) <= 3 ? 'text-warn' : ''}>{String(v)}</span>;
    return String(v);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-[13px]">
        <thead className="bg-soft text-left text-[11px] font-bold uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5">Product</th>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-right">
                <button type="button" onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}
                  className={`inline-flex items-center gap-1 uppercase hover:text-ink ${sort.key === c.key ? 'text-ink' : ''}`}>
                  {c.label}{sort.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {shown.map((r) => (
            <tr key={r.key} className="hover:bg-soft/50">
              <td className="max-w-[260px] px-4 py-2">
                <p className="truncate font-medium" title={r.name}>{r.name}</p>
                <p className="text-[11.5px] text-muted">{r.category}{r.missingCost > 0 && money ? ` · ${r.missingCost} without cost price` : ''}</p>
              </td>
              {cols.map((c) => <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right">{cell(r, c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!all && sorted.length > 25 && (
        <button type="button" onClick={() => setAll(true)} className="w-full border-t border-line py-2.5 text-[13px] font-semibold text-brand hover:bg-soft">Show all {sorted.length} products</button>
      )}
    </div>
  );
}
