'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * A section whose products are "different on every visit": the page (cached for
 * everyone) carries a few ready mixes, and each visit shows one at random.
 */
export function RandomPick({ variants }: { variants: ReactNode[] }) {
  const [pick, setPick] = useState(0);
  useEffect(() => {
    // After the first paint, so the cached page and the browser agree first.
    setPick(Math.floor(Math.random() * variants.length));
  }, [variants.length]);
  return <>{variants[pick] ?? variants[0]}</>;
}
