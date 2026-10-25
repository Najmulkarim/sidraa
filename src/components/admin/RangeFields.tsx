/** Date range inputs for GET filter forms (server component). */
export const RANGE_PRESETS: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
  { value: 'custom', label: 'Custom dates' },
];

export function RangeFields({ preset, from, to, allowAll = false }: { preset: string; from: string; to: string; allowAll?: boolean }) {
  return (
    <>
      <div className="field">
        <label htmlFor="range" className="label">Period</label>
        <select id="range" name="range" defaultValue={preset} className="input">
          {allowAll && <option value="all">All time</option>}
          {RANGE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="from" className="label">From</label>
        <input id="from" name="from" type="date" defaultValue={from} className="input" />
      </div>
      <div className="field">
        <label htmlFor="to" className="label">To</label>
        <input id="to" name="to" type="date" defaultValue={to} className="input" />
      </div>
    </>
  );
}
