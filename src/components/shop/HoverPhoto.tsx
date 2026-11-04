import { HoverSecond } from './HoverSecond';
import { ProductImage } from './ProductImage';

/**
 * A product card's photo, inside the card's photo link: when the link is
 * hovered, the second photo fades in slightly zoomed (or the only photo
 * zooms a little). Fills its positioned parent.
 */
export function HoverPhoto({ first, second, alt, sizes, className = '', priority }: { first: string | null | undefined; second?: string | null; alt: string; sizes: string; className?: string; priority?: boolean }) {
  return (
    <>
      <ProductImage
        path={first}
        alt={alt}
        sizes={sizes}
        priority={priority}
        className={`transition duration-500 ease-out in-[a:hover]:scale-105 ${className}`}
      />
      {second && (
        <HoverSecond
          path={second}
          sizes={sizes}
          className={`opacity-0 transition duration-500 ease-out in-[a:hover]:scale-105 in-[a:hover]:opacity-100 ${className}`}
        />
      )}
    </>
  );
}
