'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductImage } from './ProductImage';

/**
 * The second photo of a product card, fetched only when a mouse first moves over
 * the card's link: phones (no hover) never download it, and the page stays light.
 */
export function HoverSecond({ path, sizes, className }: { path: string; sizes: string; className: string }) {
  const mark = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const link = mark.current?.closest('a');
    if (!link || show) return;
    const on = (e: PointerEvent) => { if (e.pointerType === 'mouse') setShow(true); };
    link.addEventListener('pointerenter', on);
    return () => link.removeEventListener('pointerenter', on);
  }, [show]);
  if (show) return <ProductImage path={path} alt="" sizes={sizes} className={className} />;
  return <span ref={mark} hidden />;
}
