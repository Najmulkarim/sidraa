'use client';

import { useId, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

/**
 * The District box: after a letter or two, a small list right under it shows
 * up to 6 matching districts of Bangladesh (names that start with the letters
 * first). Click one, or use ↑ ↓ and Enter. Old spellings couriers still use
 * are listed too, and staff can still type anything else.
 */
export const DISTRICTS = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapai Nawabganj',
  'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur',
  'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokathi', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna',
  'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur',
  'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona',
  'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati',
  'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon',
  // Old spellings
  'Barisal', 'Bogra', 'Chittagong', 'Comilla', 'Jessore',
];

const SHOWN = 6;

/** Up to 6 districts for what was typed: names starting with it first, then names containing it. */
export function matchDistricts(typed: string): string[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const starts = DISTRICTS.filter((d) => d.toLowerCase().startsWith(q));
  const inside = DISTRICTS.filter((d) => !d.toLowerCase().startsWith(q) && d.toLowerCase().includes(q));
  const all = [...starts, ...inside];
  // Already the full name: nothing to suggest.
  return all.length === 1 && all[0]!.toLowerCase() === q ? [] : all.slice(0, SHOWN);
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'list'> & {
  /** Controlled value (leave out to let the box keep its own, e.g. in a plain form). */
  value?: string;
  defaultValue?: string | null;
  onValueChange?: (v: string) => void;
};

export function DistrictInput({ value, defaultValue, onValueChange, onKeyDown, onFocus, onBlur, ...rest }: Props) {
  const [own, setOwn] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const text = value ?? own;
  const matches = open && !rest.readOnly && !rest.disabled ? matchDistricts(text) : [];

  const change = (v: string) => {
    if (value === undefined) setOwn(v);
    onValueChange?.(v);
  };
  const pick = (d: string) => {
    change(d);
    setOpen(false);
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (e.key === 'Enter') e.preventDefault();
        pick(matches[Math.min(active, matches.length - 1)]!);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <input
        {...rest}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => { change(e.target.value); setOpen(true); setActive(0); }}
        onFocus={(e) => { setOpen(true); onFocus?.(e); }}
        onBlur={(e) => { setOpen(false); onBlur?.(e); }}
        onKeyDown={keys}
      />
      {matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
          {matches.map((d, i) => (
            <li
              key={d}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the box would lose focus (and close the list) first.
              onMouseDown={(e) => { e.preventDefault(); pick(d); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 text-[13.5px] ${i === active ? 'bg-soft font-semibold text-ink' : 'text-ink'}`}
            >
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
