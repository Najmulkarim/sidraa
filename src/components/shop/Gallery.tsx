'use client';

import { useEffect, useState } from 'react';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

export function Gallery({ images, name }: { images: { id: string; storage_path: string; alt: string | null }[]; name: string }) {
  const [active, setActive] = useState(0);
  const { image } = useVariantImage();
  // Picking a colour shows that colour's photo.
  useEffect(() => {
    if (!image) return;
    const i = images.findIndex((x) => x.storage_path === image);
    if (i !== -1) setActive(i);
  }, [image, images]);
  const current = images[active];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-card">
        <ProductImage path={current?.storage_path} alt={current?.alt ?? name} sizes="(min-width: 1024px) 50vw, 100vw" priority />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={`relative block h-24 w-18 overflow-hidden rounded-xl border-2 ${i === active ? 'border-brand' : 'border-transparent'}`}
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
