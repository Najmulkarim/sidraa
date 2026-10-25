'use client';

import { useActionState } from 'react';
import { subscribeNewsletter } from '@/actions/newsletter';
import type { ActionState } from '@/lib/types';

/** Email sign-up box (footer and newsletter bands). `tone` picks colours for a dark or light background. */
export function NewsletterForm({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(subscribeNewsletter, { ok: false });
  const dark = tone === 'dark';
  return (
    <form action={action} className="space-y-2">
      <div className={`flex overflow-hidden rounded-md ring-1 ${dark ? 'ring-white/25 focus-within:ring-white/60' : 'ring-line focus-within:ring-night'}`}>
        <label htmlFor={`nl-${tone}`} className="sr-only">Email address</label>
        <input id={`nl-${tone}`} name="email" type="email" required maxLength={200} placeholder="Enter your email" className={`min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[14px] outline-none ${dark ? 'text-white placeholder:text-white/45' : 'text-ink placeholder:text-muted'}`} />
        <button disabled={pending} className={`shrink-0 px-4 text-[12px] font-semibold uppercase tracking-[0.14em] transition disabled:opacity-60 ${dark ? 'bg-white text-night hover:bg-accent hover:text-white' : 'bg-night text-white hover:bg-brand'}`}>
          {pending ? '…' : 'Subscribe'}
        </button>
      </div>
      {state.message && <p role="status" className={`text-[12.5px] ${state.ok ? (dark ? 'text-accent' : 'text-ok') : dark ? 'text-[#ffb4c8]' : 'text-bad'}`}>{state.message}</p>}
    </form>
  );
}
