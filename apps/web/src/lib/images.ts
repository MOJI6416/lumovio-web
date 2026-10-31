import type { ArtImage } from "@lumovio/contracts";

/**
 * TMDB image CDN helpers. Images load straight from image.tmdb.org in the size each slot needs,
 * so the Lumovio VPS never proxies artwork.
 */
const BASE = "https://image.tmdb.org/t/p";

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";
export type BackdropSize = "w300" | "w780" | "w1280" | "original";
export type ProfileSize = "w45" | "w185" | "h632" | "original";
export type StillSize = "w92" | "w185" | "w300" | "original";

export function tmdbImage(path: string | null | undefined, size: string): string | null {
  return path ? `${BASE}/${size}${path}` : null;
}

/**
 * TMDB art in the given size; Fanart.tv art (full URLs on its CDN) as its ≤400 px copy for small
 * slots and the original otherwise.
 */
export function artImage(a: ArtImage, size: string, small = false): string | null {
  return a.source === "tmdb" ? tmdbImage(a.path, size) : small ? a.previewUrl : a.url;
}

/** srcSet for a Fanart.tv image: its 400 px copy and the original at its own width. */
export function fanartSrcSet(a: ArtImage, fullWidth: number): string | undefined {
  return a.source === "fanart" && a.url && a.previewUrl ? `${a.previewUrl} 400w, ${a.url} ${fullWidth}w` : undefined;
}

export function posterSrcSet(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return (["w185", "w342", "w500", "w780"] as const).map((s) => `${BASE}/${s}${path} ${s.slice(1)}w`).join(", ");
}

/**
 * Backdrops up to TMDB's 1920 px copy; the original (usually 3840 px, 1–3 MB) only for screens that
 * need more than 1920 device pixels. Labelling the original 1920w made every 1080p screen and TV
 * download and decode 4K art.
 */
export function backdropSrcSet(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return (["w780", "w1280", "w1920", "original"] as const)
    .map((s) => `${BASE}/${s}${path} ${s === "original" ? "3840" : s.slice(1)}w`)
    .join(", ");
}
