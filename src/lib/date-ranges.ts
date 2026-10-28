/**
 * The quick date ranges the admin date picker offers by default. Kept outside the
 * picker ('use client') so server pages can read the list too — a server page that
 * imports a value from a client file gets a reference, not the array.
 */
export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
] as const;
