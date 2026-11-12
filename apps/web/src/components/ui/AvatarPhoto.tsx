"use client";

import { type ReactNode, useState } from "react";

/**
 * A profile's photo inside its avatar circle. While it loads the circle shows the profile's colour;
 * a photo that doesn't load (deleted since, offline) gives way to `fallback` — the name's letter — so the avatar never
 * shows a broken image.
 */
export function AvatarPhoto({ src, fallback }: { src: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return fallback;
  return (
    // biome-ignore lint/performance/noImgElement: a 512 px WebP served as is, cached for good; no image optimiser here
    <img src={src} alt="" decoding="async" draggable={false} onError={() => setFailed(src)} className="absolute inset-0 size-full object-cover" />
  );
}
