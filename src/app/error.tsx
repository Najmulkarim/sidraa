'use client';

import { useEffect } from 'react';

/** Customers see a plain message; details stay in the server logs. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-4xl font-semibold">Something went wrong</h1>
      <p className="text-muted">Please try again. If it keeps happening, contact us.</p>
      {error.digest && <p className="font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
    </main>
  );
}
