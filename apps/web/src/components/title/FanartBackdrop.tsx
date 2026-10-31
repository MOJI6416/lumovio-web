"use client";

import type { ArtImage } from "@lumovio/contracts";
import { useState } from "react";
import { fanartSrcSet } from "@/lib/images";

/**
 * A Fanart.tv background for a title TMDB has no backdrop for, cropped like a TMDB backdrop. If it
 * doesn't load it removes itself, and the poster layout underneath shows.
 */
export function FanartBackdrop({ art }: { art: ArtImage }) {
  const [failed, setFailed] = useState(false);
  if (failed || !art.url) return null;
  return (
    <img
      src={art.url}
      srcSet={fanartSrcSet(art, 1920)}
      sizes="100vw"
      alt=""
      fetchPriority="high"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full bg-black object-cover object-[50%_30%] md:object-[50%_20%]"
    />
  );
}
