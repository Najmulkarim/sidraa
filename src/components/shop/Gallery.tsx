'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '../icons';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

type Photo = { id: string; storage_path: string; alt: string | null };

/**
 * Product photos, Amazon style.
 *   Phones: swipe between photos (dots + counter), tap to open full screen.
 *   Wider:  thumbnails in a column on the left, hover the photo to zoom,
 *           click to open full screen.
 * Picking a colour switches to that colour's photo.
 */
export function Gallery({ images, name, badge }: { images: Photo[]; name: string; badge?: string | null }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const { image } = useVariantImage();
  const track = useRef<HTMLDivElement>(null);

  function show(i: number) {
    setActive(i);
    const el = track.current;
    if (el && el.offsetParent !== null) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!image) return;
    const i = images.findIndex((x) => x.storage_path === image);
    if (i !== -1) show(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, images]);

  function onSwipe() {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active && images[i]) setActive(i);
  }

  // Thumbnail column: exactly as tall as the main photo; the rest scrolls,
  // with arrows and a fade shown only on the side that has more.
  const thumbs = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ up: false, down: false });
  function measureThumbs() {
    const el = thumbs.current;
    if (!el) return;
    setMore({ up: el.scrollTop > 2, down: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
  }
  function pageThumbs(dir: 1 | -1) {
    const el = thumbs.current;
    if (el) el.scrollBy({ top: dir * el.clientHeight * 0.75, behavior: 'smooth' });
  }
  useEffect(() => {
    measureThumbs();
    window.addEventListener('resize', measureThumbs);
    return () => window.removeEventListener('resize', measureThumbs);
  }, [images.length]);
  // Keep the chosen photo's thumbnail in view (scrolls the column only, never the page).
  useEffect(() => {
    const el = thumbs.current;
    const item = el?.children[active] as HTMLElement | undefined;
    if (!el || !item) return;
    if (item.offsetTop < el.scrollTop) el.scrollTo({ top: item.offsetTop, behavior: 'smooth' });
    else if (item.offsetTop + item.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTo({ top: item.offsetTop + item.offsetHeight - el.clientHeight, behavior: 'smooth' });
  }, [active]);

  function onZoomMove(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const current = images[active];
  const many = images.length > 1;
  const badgeEl = badge ? <span className="absolute left-3 top-3 z-10 rounded-md bg-brand px-2 py-1 text-[12px] font-bold text-white shadow">{badge}</span> : null;

  return (
    <div className="min-w-0 md:sticky md:top-24 md:self-start">
      {/* Phones: swipe, tap for full screen */}
      <div className="relative -mx-4 md:hidden">
        {badgeEl}
        <div ref={track} onScroll={onSwipe} className="flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(images.length ? images : [null]).map((img, i) => (
            <button key={img?.id ?? 'none'} type="button" onClick={() => img && setFullScreen(true)} className="relative h-full w-full shrink-0 snap-center" aria-label={img ? `Open photo ${i + 1} full screen` : name}>
              <ProductImage path={img?.storage_path} alt={img?.alt ?? name} sizes="100vw" priority={i === 0} className="object-contain!" />
            </button>
          ))}
        </div>
        {many && (
          <>
            <span className="absolute right-4 top-3 rounded-full bg-night/60 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">
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
      {many && (
        <ul className="mt-3 flex gap-2 overflow-x-auto md:hidden" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button type="button" onClick={() => show(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active} className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 bg-card transition ${i === active ? 'border-brand' : 'border-line opacity-70'}`}>
                <ProductImage path={img.storage_path} alt="" sizes="64px" className="object-contain!" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Tablets and up: thumbnail column + hover zoom */}
      <div className={`hidden gap-3 md:grid ${many ? 'md:grid-cols-[4.5rem_minmax(0,1fr)]' : ''}`}>
        {many && (
          // The cell stretches to the main photo's height; the list fills it absolutely and scrolls inside.
          <div className="relative min-h-0">
          <ul
            ref={thumbs}
            onScroll={measureThumbs}
            className="absolute inset-0 flex snap-y flex-col gap-2 overflow-y-auto overscroll-contain py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Product photos"
          >
            {images.map((img, i) => (
              <li key={img.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => show(i)}
                  onMouseEnter={() => setActive(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === active}
                  className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-card transition ${i === active ? 'border-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)]' : 'border-line hover:border-ink/40'}`}
                >
                  <ProductImage path={img.storage_path} alt="" sizes="72px" className="object-contain!" />
                </button>
              </li>
            ))}
          </ul>
          {more.up && (
            <button type="button" onClick={() => pageThumbs(-1)} aria-label="Earlier photos" className="absolute inset-x-0 top-0 z-10 flex h-10 items-start justify-center bg-[linear-gradient(180deg,var(--paper)_35%,transparent)] pt-0.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-card shadow ring-1 ring-line"><Icon name="arrow" size={14} className="-rotate-90" /></span>
            </button>
          )}
          {more.down && (
            <button type="button" onClick={() => pageThumbs(1)} aria-label={`More photos (${images.length} in all)`} className="absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center bg-[linear-gradient(0deg,var(--paper)_35%,transparent)] pb-0.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-card shadow ring-1 ring-line"><Icon name="arrow" size={14} className="rotate-90" /></span>
            </button>
          )}
          </div>
        )}
        <div className="relative">
          {badgeEl}
          <button
            type="button"
            onClick={() => current && setFullScreen(true)}
            onMouseMove={onZoomMove}
            onMouseLeave={() => setZoom(null)}
            aria-label="Open photo full screen"
            className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-card"
          >
            <span
              className="absolute inset-0 transition-transform duration-200 ease-out"
              style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            >
              <ProductImage key={current?.id} path={current?.storage_path} alt={current?.alt ?? name} sizes="(min-width: 1280px) 40vw, (min-width: 768px) 50vw, 100vw" priority className="animate-[fade-in_0.3s_ease-out] object-contain!" />
            </span>
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-night/60 px-3 py-1.5 text-[12px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Icon name="search" size={14} /> Click to see full view
            </span>
          </button>
        </div>
      </div>

      {fullScreen && <FullScreen images={images} start={active} name={name} onClose={(i) => { setFullScreen(false); show(i); }} />}
    </div>
  );
}

/** Full-screen viewer: swipe or arrow keys between photos, Escape or × to close. */
function FullScreen({ images, start, name, onClose }: { images: Photo[]; start: number; name: string; onClose: (index: number) => void }) {
  const [i, setI] = useState(start);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollTo({ left: start * el.clientWidth });
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [start]);

  function go(n: number) {
    const next = (n + images.length) % images.length;
    setI(next);
    strip.current?.scrollTo({ left: next * strip.current.clientWidth, behavior: 'smooth' });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(i);
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[60] flex animate-[fade-in_0.2s_ease-out] flex-col bg-night/95">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">{i + 1} / {images.length}</span>
        <button type="button" onClick={() => onClose(i)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
          <Icon name="x" size={22} />
        </button>
      </div>
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / el.clientWidth);
          if (n !== i && images[n]) setI(n);
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img) => (
          <div key={img.id} className="relative h-full w-full shrink-0 snap-center">
            <ProductImage path={img.storage_path} alt={img.alt ?? name} sizes="100vw" className="object-contain!" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid" aria-label="Previous photo">
            <Icon name="arrow" size={22} className="rotate-180" />
          </button>
          <button type="button" onClick={() => go(i + 1)} className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid" aria-label="Next photo">
            <Icon name="arrow" size={22} />
          </button>
          <ul className="flex justify-center gap-2 overflow-x-auto px-4 py-3">
            {images.map((img, n) => (
              <li key={img.id} className="shrink-0">
                <button type="button" onClick={() => go(n)} aria-label={`Photo ${n + 1}`} className={`relative block h-14 w-14 overflow-hidden rounded-lg border-2 bg-white ${n === i ? 'border-accent' : 'border-transparent opacity-60'}`}>
                  <ProductImage path={img.storage_path} alt="" sizes="56px" className="object-contain!" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
