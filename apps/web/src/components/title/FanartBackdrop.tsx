"use client";

import type { ArtImage } from "@lumovio/contracts";
import { useState } from "react";
import { BACKDROP_SIZES, fanartSrcSet } from "@/lib/images";

/**
 * A Fanart.tv background for a title TMDB has no backdrop for, in the hero's art box as a TMDB backdrop is (7.14). If
 * it doesn't load it removes itself, and the poster layout underneath shows.
 */
export function FanartBackdrop({ art }: { art: ArtImage }) {
  const [failed, setFailed] = useState(false);
  if (failed || !art.url) return null;
  return (
    <img
      src={art.url}
      srcSet={fanartSrcSet(art, 1920)}
      sizes={BACKDROP_SIZES}
      alt=""
      fetchPriority="high"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full bg-black object-cover object-[50%_10%]"
    />
  );
}
