'use client';

import { useFormStatus } from 'react-dom';
import { startTransition, useActionState, type FormEvent, type ReactNode } from 'react';
import type { ActionState } from '@/lib/types';

/**
 * useActionState for admin forms that must keep what the admin typed when
 * the server rejects it. <form action> resets uncontrolled fields after
 * every submission (React 19); submitting through onSubmit does not.
 */
export function useKeepValuesAction(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, { ok: false } as ActionState);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, onSubmit, pending };
}

export function PendingButton({ pending, children, pendingText = 'Saving…', className = 'btn btn-primary' }: { pending: boolean; children: ReactNode; pendingText?: string; className?: string }) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function SubmitButton({ children, pendingText = 'Saving…', className = 'btn btn-primary' }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? 'status' : 'alert'} className={`rounded-xl px-4 py-3 text-sm ${state.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
      {state.message}
    </p>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="error">{msg}</p> : null;
}
