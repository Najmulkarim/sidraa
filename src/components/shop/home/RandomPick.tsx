'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Product page address of a link, without any ?query. */
const slugOf = (a: Element) => (a.getAttribute('href') ?? '').split('?')[0]!;
const LINKS = 'a[href^="/product/"]';

/**
 * A section whose products are "different on every visit". The page (cached for
 * everyone) carries the section once with a bigger pool of products; each visit
 * shows a random `limit` of them. Before the script runs, the pool's extra
 * products are hidden by CSS, so nothing jumps; then a fresh random set shows.
 * Only CSS order/display change: the page's own markup is never moved.
 */
export function RandomPick({ id, limit, hidden, children }: { id: string; limit: number; hidden: string[]; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    // Each product's card: the largest block around its link that holds no other product.
    const cards = new Map<string, HTMLElement>();
    for (const a of root.querySelectorAll(LINKS)) {
      const slug = slugOf(a);
      if (cards.has(slug)) continue;
      let el = a as HTMLElement;
      while (el.parentElement && el.parentElement !== root && [...el.parentElement.querySelectorAll(LINKS)].every((x) => slugOf(x) === slug)) el = el.parentElement;
      cards.set(slug, el);
    }
    const list = [...cards.values()];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; }
    list.forEach((el, n) => {
      if (n < limit) { el.style.order = String(n); el.style.display = ''; }
      else el.style.display = 'none';
    });
    setReady(true);
  }, [limit]);

  // Until then: hide the pool's extra products (every block that holds only that product's links).
  const css = hidden
    .filter((s) => /^[a-z0-9-]+$/i.test(s))
    .map((s) => `[data-mix="${id}"]:not([data-ready]) *:has(a[href="/product/${s}"]):not(:has(a[href^="/product/"]:not([href="/product/${s}"])))`)
    .join(',');
  return (
    <div ref={box} data-mix={id} data-ready={ready ? '' : undefined} className="contents">
      {css && <style dangerouslySetInnerHTML={{ __html: `${css}{display:none}` }} />}
      {children}
    </div>
  );
}
