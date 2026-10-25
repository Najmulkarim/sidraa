'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag-to-reorder with the mouse or a finger (pointer events, so it also
 * works on phones where HTML drag-and-drop does not). Each item element
 * needs data-sort-index={i}. With a mouse the whole item can be grabbed;
 * with a finger too, unless handleOnlyTouch is set: then only the handle
 * (handleProps) drags on phones, so the page still scrolls.
 * The list re-orders live; onDrop gets the final order once, on release.
 * wasDrag() tells a click handler to ignore the click that ends a drag.
 */
export function useDragSort<T>(items: T[], onDrop: (next: T[]) => void, { handleOnlyTouch = false }: { handleOnlyTouch?: boolean } = {}) {
  const [order, setOrder] = useState<T[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const from = useRef<number | null>(null);
  const moved = useRef(false);
  const latest = useRef<T[] | null>(null);
  const justDragged = useRef(false);
  // Pressed but not moved yet: a plain click stays a click until the pointer travels a few pixels.
  const armed = useRef<{ index: number; x: number; y: number; el: HTMLElement; id: number } | null>(null);
  const list = order ?? items;

  function start(e: ReactPointerEvent<HTMLElement>, index: number) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const onHandle = !!target.closest('[data-drag-handle]');
    if (handleOnlyTouch && e.pointerType !== 'mouse' && !onHandle) return;
    // Buttons, switches, inputs and links keep working (a button marked data-draggable can be grabbed).
    if (!onHandle && target.closest('button:not([data-draggable]), input, textarea, select, a, [role="switch"]')) return;
    if (onHandle) e.preventDefault();
    armed.current = { index, x: e.clientX, y: e.clientY, el: e.currentTarget as HTMLElement, id: e.pointerId };
    // The handle starts at once; anywhere else waits for a small movement.
    if (onHandle) begin();
  }

  function begin() {
    const a = armed.current;
    if (!a) return;
    armed.current = null;
    from.current = a.index;
    moved.current = false;
    latest.current = items;
    setOrder(items);
    setDragging(a.index);
    try { a.el.setPointerCapture(a.id); } catch { /* pointer already gone */ }
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    if (armed.current && Math.hypot(e.clientX - armed.current.x, e.clientY - armed.current.y) > 6) {
      window.getSelection()?.removeAllRanges();
      begin();
    }
    if (from.current === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sort-index]');
    if (!el) return;
    const to = Number(el.getAttribute('data-sort-index'));
    const f = from.current;
    if (!Number.isInteger(to) || to === f) return;
    const next = [...(latest.current ?? items)];
    const [x] = next.splice(f, 1);
    next.splice(to, 0, x!);
    latest.current = next;
    setOrder(next);
    from.current = to;
    moved.current = true;
    setDragging(to);
  }

  function end() {
    armed.current = null;
    if (from.current === null) return;
    const final = latest.current;
    from.current = null;
    latest.current = null;
    setDragging(null);
    setOrder(null);
    if (moved.current && final) {
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      onDrop(final);
    }
  }

  const handlers = (index: number) => ({
    'data-sort-index': index,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, index),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    ...(handleOnlyTouch ? {} : { style: { touchAction: 'none' as const, cursor: dragging === null ? 'grab' : 'grabbing' } }),
  });

  const handleProps = { 'data-drag-handle': true, style: { touchAction: 'none' as const, cursor: dragging === null ? 'grab' : 'grabbing' } };

  return { list, dragging, handlers, handleProps, wasDrag: () => justDragged.current };
}
