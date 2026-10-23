'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag-to-reorder for a grid of items, with the mouse or a finger (pointer
 * events, so it also works on phones where HTML drag-and-drop does not).
 * Each item element needs data-sort-index={i}. The list re-orders live
 * while dragging; onDrop gets the final order once, when the pointer lifts.
 */
export function useDragSort<T>(items: T[], onDrop: (next: T[]) => void) {
  const [order, setOrder] = useState<T[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const from = useRef<number | null>(null);
  const moved = useRef(false);
  const list = order ?? items;

  function start(e: ReactPointerEvent<HTMLElement>, index: number) {
    if (e.button !== 0) return;
    // Buttons and inputs inside the card keep working normally.
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    e.preventDefault();
    from.current = index;
    moved.current = false;
    setOrder(items);
    setDragging(index);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    if (from.current === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sort-index]');
    if (!el) return;
    const to = Number(el.getAttribute('data-sort-index'));
    const f = from.current;
    if (!Number.isInteger(to) || to === f) return;
    // Capture the index now: the updater below runs later, after from.current changes.
    setOrder((cur) => {
      const next = [...(cur ?? items)];
      const [x] = next.splice(f, 1);
      next.splice(to, 0, x!);
      return next;
    });
    from.current = to;
    moved.current = true;
    setDragging(to);
  }

  function end() {
    if (from.current === null) return;
    const final = order;
    from.current = null;
    setDragging(null);
    setOrder(null);
    if (moved.current && final) onDrop(final);
  }

  const handlers = (index: number) => ({
    'data-sort-index': index,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, index),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    style: { touchAction: 'none' as const, cursor: dragging === null ? 'grab' : 'grabbing' },
  });

  return { list, dragging, handlers };
}
