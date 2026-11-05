'use client';

import { useEffect, useRef } from 'react';

/** Inside a sideways chip row: scrolls the row so the current chip is in view (phones). */
export function ChipRowFocus() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = mark.current?.parentElement;
    const on = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  });
  return <span ref={mark} hidden />;
}
