'use client';

import { useActionState } from 'react';
import { signIn } from '@/actions/auth';
import type { ActionState } from '@/lib/types';
import { FieldError, FormMessage, SubmitButton } from './ui';

const initial: ActionState = { ok: false };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && !state.message && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">{notice}</p>}
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div className="field">
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        <FieldError state={state} name="password" />
      </div>
      <SubmitButton pendingText="Signing in…" className="btn btn-primary w-full">Sign in</SubmitButton>
    </form>
  );
}
