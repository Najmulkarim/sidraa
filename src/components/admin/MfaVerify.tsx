'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';

/** Second step of sign-in for admins who enrolled an authenticator app. */
export function MfaVerify() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getBrowserClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === 'verified');
    if (listError || !factor) {
      setBusy(false);
      setError('No authenticator is set up for this account. Sign in again.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) {
      setError('That code did not work. Check the time on your phone and try the newest code.');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="field">
        <label htmlFor="code" className="label">Authentication code</label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="input text-center font-mono text-2xl tracking-[0.4em]"
          autoFocus
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button>
    </form>
  );
}
