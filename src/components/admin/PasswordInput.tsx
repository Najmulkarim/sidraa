'use client';

import { useState } from 'react';
import { Icon } from '../icons';

/** A strong password that is easy to read out: no 0/O or 1/l/I. */
function strongPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Password box with an eye to show what is typed, and "Generate" for a strong one
 * (shown, so it can be copied and given to the person before saving).
 * Saved passwords cannot be shown: they are stored only as a one-way hash.
 */
export function PasswordInput({ id, name, label, placeholder = 'At least 10 characters', ariaLabel }: { id: string; name: string; label?: string; placeholder?: string; ariaLabel?: string }) {
  const [value, setValue] = useState('');
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = () => { setValue(strongPassword()); setShown(true); setCopied(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => { setValue(e.target.value); setCopied(false); }}
          autoComplete="new-password"
          minLength={10}
          maxLength={200}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`input pr-11 ${shown ? 'font-mono text-[13px]' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          title={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-1 my-auto grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
        >
          <Icon name="eye" size={17} className={shown ? 'text-brand' : ''} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-[12px]">
        <button type="button" onClick={generate} className="font-semibold text-brand hover:underline">Generate</button>
        {value && <button type="button" onClick={copy} className="font-semibold text-muted hover:text-ink">{copied ? 'Copied ✓' : 'Copy'}</button>}
      </div>
    </div>
  );
}
