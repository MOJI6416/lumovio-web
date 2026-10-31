"use client";

import type { ArtImage, TitleLogoArt } from "@lumovio/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { artImage, fanartSrcSet } from "@/lib/images";

/*
 * A logo is "dark" — unreadable on the stage without a halo — when most of it is near black: black or navy lettering
 * drawn for a light page. Near black: a relative luminance under 0.04, under about 1.7 : 1 against the stage. Saturated
 * colours (a red title with a blue outline) read well on the stage and stay.
 */
const NEAR_BLACK = 0.04;
const DARK_SHARE = 0.6;

/** An sRGB channel (0–255) in linear light, as WCAG's relative luminance takes it. */
const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** The share (0–1) of the opaque pixels that are near black, from a small copy of the image. */
function darkShare(img: HTMLImageElement): number | null {
  try {
    const w = 48;
    const h = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let dark = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3]! < 128) continue;
      if (0.2126 * linear(px[i]!) + 0.7152 * linear(px[i + 1]!) + 0.0722 * linear(px[i + 2]!) < NEAR_BLACK) dark++;
      n++;
    }
    return n > 0 ? dark / n : null;
  } catch {
    return null;
  }
}

/**
 * A title's logo art over Lumovio's dark stage, with no glow or halo around it (owner, 2026-10-25): the stage's scrims
 * keep it legible (3.5). Many logos are drawn for light backgrounds, and a dark one would vanish on the stage — so each
 * logo is checked first (a small copy fetched with CORS: TMDB's and Fanart.tv's CDNs allow it, so the displayed image
 * is never tainted or downloaded twice at full size) and shown only when it is light enough. A dark logo, or one that
 * doesn't load, gives way to the other provider's logo, then to `children` (the title as text). The logo shows while
 * the check runs (a dark one is all but invisible on the stage meanwhile); a check that can't run (no CORS) keeps it.
 */
export function TitleLogo({ logo, alt, className, children }: { logo: TitleLogoArt; alt: string; className?: string; children: ReactNode }) {
  const [art, setArt] = useState<ArtImage | null>(logo);
  useEffect(() => setArt(logo), [logo]);
  const next = () => setArt((a) => (a === logo ? logo.fallback : null));
  const probeSrc = art ? artImage(art, "w92", true) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `next` reads only the logo, which `probeSrc` follows
  useEffect(() => {
    if (!probeSrc) return;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      const share = darkShare(probe);
      if (share !== null && share > DARK_SHARE) next();
    };
    probe.src = probeSrc;
    return () => {
      probe.onload = null;
    };
  }, [probeSrc]);
  if (!art) return <>{children}</>;
  // The box is laid out before the file arrives, so the hero doesn't move when it does (CLS): as wide as the height
  // limit (`--logo-h`, from the caller) allows at the art's proportions — no wider than TMDB's w500 file itself, nor
  // than the caller's max-width — and as tall as that width gives. Without known proportions, the file's own size.
  const r = art.aspectRatio > 0 ? art.aspectRatio : null;
  return (
    <img
      key={art.url ?? art.path}
      src={artImage(art, "w500") ?? undefined}
      srcSet={fanartSrcSet(art, 800)}
      sizes="(min-width: 768px) 520px, 82vw"
      width={r ? 500 : undefined}
      height={r ? Math.round(500 / r) : undefined}
      style={r ? { width: art.source === "tmdb" ? `min(calc(var(--logo-h) * ${r}), 500px)` : `calc(var(--logo-h) * ${r})` } : undefined}
      alt={alt}
      onError={next}
      className={cn("h-auto", r ? null : "w-auto max-h-(--logo-h)", className)}
    />
  );
}
