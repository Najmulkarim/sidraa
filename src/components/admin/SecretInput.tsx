'use client';

import { useState } from 'react';
import type { ActionState } from '@/lib/types';
import { FieldError } from './ui';

/**
 * A key / password field that never shows the saved value. The server only
 * sends a masked hint (••••1234). Leave empty to keep it; tick Remove to clear.
 */
export function SecretInput({ name, label, saved, state, hint, generate }: { name: string; label: string; saved: string | null; state: ActionState; hint?: string; generate?: boolean }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={name} className="label flex items-center justify-between gap-2">
        <span>{label}</span>
        {saved && <span className="font-mono text-[11px] font-normal text-ok">saved {saved}</span>}
      </label>
      <div className="flex gap-1.5">
        <input
          id={name}
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={saved ? 'Leave empty to keep the saved value' : 'Not set'}
          className="input font-mono"
          maxLength={300}
        />
        <button type="button" className="btn btn-ghost btn-sm min-h-11 px-3" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide' : 'Show'}>{show ? 'Hide' : 'Show'}</button>
        {generate && (
          <button
            type="button"
            className="btn btn-outline btn-sm min-h-11 whitespace-nowrap px-3"
            onClick={() => {
              const b = new Uint8Array(24);
              crypto.getRandomValues(b);
              setValue(Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''));
              setShow(true);
            }}
          >
            Generate
          </button>
        )}
      </div>
      {hint && <p className="hint">{hint}</p>}
      {saved && (
        <label className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" name={`clear_${name}`} className="h-3.5 w-3.5 accent-[var(--brand)]" /> Remove the saved value
        </label>
      )}
      <FieldError state={state} name={name} />
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="flex gap-1.5">
        <input readOnly value={value} className="input bg-soft font-mono text-[12.5px]" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <button
          type="button"
          className="btn btn-outline btn-sm min-h-11 px-3"
          onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
