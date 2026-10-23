'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

export function Gallery({ images, name }: { images: { id: string; storage_path: string; alt: string | null }[]; name: string }) {
  const [active, setActive] = useState(0);
  const { image } = useVariantImage();
  // Phones swipe through the photos; this is the scrolling strip.
  const track = useRef<HTMLDivElement>(null);

  function show(i: number) {
    setActive(i);
    const el = track.current;
    if (el && el.offsetParent !== null) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  // Picking a colour shows that colour's photo.
  useEffect(() => {
    if (!image) return;
    const i = images.findIndex((x) => x.storage_path === image);
    if (i !== -1) show(i);
  }, [image, images]);

  function onSwipe() {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active && images[i]) setActive(i);
  }

  const current = images[active];

  return (
    <div className="space-y-3">
      {/* Phones: swipe between photos, dots show where you are. */}
      <div className="relative -mx-4 md:hidden">
        <div ref={track} onScroll={onSwipe} className="flex aspect-[3/4] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(images.length ? images : [null]).map((img, i) => (
            <div key={img?.id ?? 'none'} className="relative h-full w-full shrink-0 snap-center bg-card">
              <ProductImage path={img?.storage_path} alt={img?.alt ?? name} sizes="100vw" priority={i === 0} />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <span className="absolute right-4 top-4 rounded-full bg-night/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {active + 1} / {images.length}
            </span>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
              {images.map((img, i) => (
                <span key={img.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-5 bg-brand' : 'w-1.5 bg-night/25'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative hidden aspect-[3/4] overflow-hidden rounded-3xl bg-card md:block">
        <ProductImage key={current?.id} path={current?.storage_path} alt={current?.alt ?? name} sizes="(min-width: 1024px) 50vw, 100vw" priority className="animate-[fade-in_0.35s_ease-out]" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={`relative block h-24 w-18 overflow-hidden rounded-xl border-2 transition active:scale-95 ${i === active ? 'border-brand' : 'border-transparent opacity-70'}`}
              >
                <ProductImage path={img.storage_path} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
