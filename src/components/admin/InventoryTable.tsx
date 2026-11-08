'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTaka } from '@/lib/format';
import { DEFAULT_SORT, filterRows, inventoryCsv, sortRows, STATUS_LABEL, stockStatus, totals, type InventoryFilter, type InventoryRow, type Sort, type SortKey, type StockStatus } from '@/lib/inventory';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { AdjustStockForm } from './AdjustStockForm';

const PAGE = 50;
const CHIP: Record<StockStatus, string> = {
  in: 'bg-[#dcfce7] text-[#15803d]',
  low: 'bg-[#fef3c7] text-[#92400e]',
  out: 'bg-[#fee2e2] text-[#b91c1c]',
};

/**
 * The stock list: photo, SKU, name, category, stock, reorder level, status,
 * cost and stock value. Search and filters work at once; Excel and Print take
 * what is shown. Adjust opens a small window.
 */
export function InventoryTable({ rows, threshold, categories, withCost, lowOnly }: { rows: InventoryRow[]; threshold: number; categories: { id: string; name: string }[]; withCost: boolean; lowOnly: boolean }) {
  const [f, setF] = useState<InventoryFilter>({ q: '', category: '', status: lowOnly ? 'need' : '' });
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState<InventoryRow | null>(null);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const shown = useMemo(() => sortRows(filterRows(rows, f, threshold), sort), [rows, f, threshold, sort]);
  const t = useMemo(() => totals(shown, threshold), [shown, threshold]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const list = shown.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => setPage(1), [f, sort]);
  // Click a heading: sort by it (numbers start high, words start at A); click again to flip.
  const sortBy = (key: SortKey) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'sku' || key === 'category' ? 'asc' : 'desc' }));
  const th = (key: SortKey, label: string, right = false) => (
    <th className={`px-3 py-2.5 ${right ? 'text-right' : ''}`} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => sortBy(key)} title={`Sort by ${label.toLowerCase()}`} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${sort.key === key ? 'text-brand' : ''} ${right ? 'flex-row-reverse' : ''}`}>
        {label}
        <span aria-hidden="true" className={`text-[10px] ${sort.key === key ? '' : 'opacity-30'}`}>{sort.key === key && sort.dir === 'asc' ? '▲' : '▼'}</span>
      </button>
    </th>
  );
  const set = (patch: Partial<InventoryFilter>) => setF((cur) => ({ ...cur, ...patch }));

  function excel() {
    const blob = new Blob([inventoryCsv(shown, threshold, withCost)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-2 p-3 print:hidden">
        <label className="relative min-w-52 flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search name, SKU or colour / size" aria-label="Search" className="input h-10 pl-9 text-[13.5px]" />
        </label>
        <select value={f.category} onChange={(e) => set({ category: e.target.value })} aria-label="Category" className="input h-10 w-auto min-w-40 text-[13.5px]">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={f.status} onChange={(e) => set({ status: e.target.value as InventoryFilter['status'] })} aria-label="Status" className="input h-10 w-auto min-w-36 text-[13.5px]">
          <option value="">All statuses</option>
          <option value="in">In stock</option>
          <option value="need">Low + out of stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <button type="button" onClick={() => setF({ q: '', category: '', status: '' })} className="btn btn-outline btn-sm h-10">Clear</button>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm h-10"><Icon name="printer" size={15} /> Print</button>
          <button type="button" onClick={excel} className="btn btn-sm h-10 border-0 bg-[#d9a441] text-night hover:brightness-105"><Icon name="download" size={15} /> Excel</button>
        </span>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Records" value={t.records.toLocaleString('en-IN')} />
        <Card label="Total quantity" value={t.units.toLocaleString('en-IN')} />
        {withCost && <Card label="Total value (at cost)" value={formatTaka(t.value)} hint={t.valueMissing ? `${t.valueMissing} without a cost price` : undefined} />}
        <Card label="Low stock" value={String(t.low)} tone="warn" onClick={() => set({ status: 'low' })} />
        <Card label="Out of stock" value={String(t.out)} tone="bad" onClick={() => set({ status: 'out' })} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <p className="border-b border-line px-4 py-2.5 text-[12px] text-muted">Showing {shown.length === 0 ? 0 : (page - 1) * PAGE + 1}–{Math.min(page * PAGE, shown.length)} of {shown.length}</p>
        <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-soft text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
              {th('name', 'Product')}
              {th('sku', 'SKU')}
              {th('category', 'Category')}
              {th('stock', 'Current stock', true)}
              <th className="px-3 py-2.5 text-right">Reorder level</th>
              <th className="px-3 py-2.5">Status</th>
              {withCost && th('cost', 'Cost price', true)}
              {withCost && th('value', 'Stock value', true)}
              <th className="px-3 py-2.5 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} className="py-14 text-center text-muted">Nothing matches.</td></tr>}
            {list.map((r) => {
              const s = stockStatus(r.stock, threshold);
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-soft/60">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-tint ring-1 ring-line"><ProductImage path={r.image} alt="" sizes="40px" /></span>
                      <span className="min-w-0">
                        <span className="block max-w-[260px] truncate font-semibold text-ink" title={r.name}>{r.name}</span>
                        <span className="block text-[11.5px] text-muted">{r.variant || 'Default'}{!r.active ? ' · hidden in shop' : ''}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px]">{r.sku}</td>
                  <td className="px-3 py-2 text-muted">{r.category ?? '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono text-[13px] font-bold ${s === 'out' ? 'text-bad' : s === 'low' ? 'text-warn' : 'text-ink'}`}>{r.stock}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{threshold}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${CHIP[s]}`}>{STATUS_LABEL[s]}</span></td>
                  {withCost && <td className="px-3 py-2 text-right font-mono">{r.cost === null ? <span className="text-muted">—</span> : formatTaka(r.cost)}</td>}
                  {withCost && <td className="px-3 py-2 text-right font-mono font-semibold">{r.cost === null ? <span className="text-muted">—</span> : formatTaka(Math.max(0, r.stock) * r.cost)}</td>}
                  <td className="px-3 py-2 text-right print:hidden">
                    <button type="button" onClick={() => setAdjust(r)} className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold hover:border-brand hover:text-brand">Adjust</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-end gap-2 print:hidden" aria-label="Pages">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line disabled:opacity-30">‹</button>
          <span className="font-mono text-[13px]">{page} / {pages}</span>
          <button type="button" disabled={page === pages} onClick={() => setPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line disabled:opacity-30">›</button>
        </nav>
      )}

      {adjust && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/50 p-3 backdrop-blur-sm" onClick={() => setAdjust(null)}>
          <div role="dialog" aria-modal="true" aria-label="Adjust stock" className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={adjust.image} alt="" sizes="56px" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{adjust.name}</h2>
                <p className="text-[12.5px] text-muted">{adjust.variant || 'Default'} · <span className="font-mono">{adjust.sku}</span></p>
              </div>
              <button type="button" onClick={() => setAdjust(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-soft text-muted hover:bg-line"><Icon name="x" size={16} /></button>
            </div>
            <AdjustStockForm key={adjust.id} variantId={adjust.id} current={adjust.stock} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Card({ label, value, hint, tone, onClick }: { label: string; value: string; hint?: string; tone?: 'warn' | 'bad'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`card p-3.5 text-left ${onClick ? 'transition hover:border-brand' : ''}`}>
      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className={`mt-1 block font-mono text-xl font-bold ${tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{value}</span>
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </Tag>
  );
}
