'use client';

import { useState } from 'react';
import { NAV_COOKIE } from '@/lib/admin-nav';
import { Icon } from '../icons';


/**
 * Big screens: folds the admin menu to a slim strip of icons (more room on a laptop)
 * and opens it again. Remembered in a cookie, so the next page opens the same way.
 */
export function NavToggle({ initialMini }: { initialMini: boolean }) {
  const [mini, setMini] = useState(initialMini);
  const toggle = () => {
    const next = !mini;
    setMini(next);
    document.getElementById('admin-shell')?.setAttribute('data-nav', next ? 'mini' : 'full');
    document.cookie = `${NAV_COOKIE}=${next ? 'mini' : 'full'}; path=/admin; max-age=31536000; samesite=lax`;
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title={mini ? 'Open the menu' : 'Fold the menu (more room)'}
      aria-label={mini ? 'Open the menu' : 'Fold the menu'}
      aria-expanded={!mini}
      className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink/70 transition hover:border-brand hover:text-brand lg:grid"
    >
      <Icon name="menu" size={18} />
    </button>
  );
}
