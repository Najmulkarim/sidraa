'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Icon } from '../icons';

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink hover:border-brand hover:text-brand"
      title="Refresh"
      aria-label="Refresh"
    >
      <Icon name="refresh" size={18} className={pending ? 'animate-spin' : ''} />
    </button>
  );
}
