'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/** Lets the size/colour picker tell the photo gallery which photo to show. */
type Value = { image: string | null; setImage: (path: string | null) => void };
const Ctx = createContext<Value>({ image: null, setImage: () => {} });

export function VariantImageProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<string | null>(null);
  return <Ctx value={{ image, setImage }}>{children}</Ctx>;
}

export const useVariantImage = (): Value => useContext<Value>(Ctx);
