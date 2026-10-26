import Image from 'next/image';
import { imageUrl } from '@/lib/env';

/**
 * Product photo from Storage, or a neutral placeholder when the product
 * has no image yet (the seed ships without photos on purpose).
 */
export function ProductImage({
  path,
  alt,
  sizes,
  priority = false,
  className = '',
  quality,
}: {
  path: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** 90 for big banners; 75 (the default) otherwise. */
  quality?: 75 | 90;
}) {
  const src = imageUrl(path);
  if (!src) {
    const initials = alt
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--tint),color-mix(in_oklab,var(--accent)_16%,white))] ${className}`}
      >
        <span className="font-display text-4xl text-brand/50">{initials || '•'}</span>
      </div>
    );
  }
  // SVG illustrations and files under /public are served as they are.
  const unoptimized = src.startsWith('/') || src.endsWith('.svg');
  // priority: the photo at the top of the page — fetched first, never lazy (Next 16 replaces `priority` with these).
  return <Image src={src} alt={alt} fill sizes={sizes} loading={priority ? 'eager' : undefined} fetchPriority={priority ? 'high' : undefined} quality={quality} unoptimized={unoptimized} className={`object-cover ${className}`} />;
}
