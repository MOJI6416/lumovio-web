import type { ArtImage } from "@lumovio/contracts";
import { imageUrl, parseImageRef, sourceUrl } from "@lumovio/contracts/images";
import { preload } from "react-dom";

/**
 * Image addresses. A picture in an API answer is TMDB's file path, or another source's path after its name
 * ("fanart:/…"); its address is built from that source's host and the size each slot needs
 * (@lumovio/contracts/images, the one place that names the hosts). Images load straight from the sources' CDNs, so the
 * Lumovio VPS never proxies artwork.
 */

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";
export type BackdropSize = "w300" | "w780" | "w1280" | "original";
export type ProfileSize = "w45" | "w185" | "h632" | "original";
export type StillSize = "w92" | "w185" | "w300" | "original";

/** A picture in the given size (TMDB's size names; another source gives its nearest copy). */
export function tmdbImage(path: string | null | undefined, size: string): string | null {
  return imageUrl(path, size);
}

/** srcSet of a picture whose source has only its ≤400 px copy and the original. */
const previewAndOriginal = (ref: string, fullWidth: number) => `${imageUrl(ref, "preview")} 400w, ${imageUrl(ref, "original")} ${fullWidth}w`;

/** A logo's or a background's file: from its path, else the full addresses the answer gave (Fanart.tv). */
const artUrls = (a: ArtImage) =>
  a.path ? { url: sourceUrl(a.source, a.path, "original"), previewUrl: sourceUrl(a.source, a.path, "preview") } : { url: a.url, previewUrl: a.previewUrl };

/**
 * TMDB art in the given size; Fanart.tv art as its ≤400 px copy for small slots and the original otherwise.
 */
export function artImage(a: ArtImage, size: string, small = false): string | null {
  if (a.source === "tmdb") return tmdbImage(a.path, size);
  const u = artUrls(a);
  return small ? u.previewUrl : u.url;
}

/** srcSet for a Fanart.tv image: its 400 px copy and the original at its own width. */
export function fanartSrcSet(a: ArtImage, fullWidth: number): string | undefined {
  if (a.source !== "fanart") return undefined;
  const u = artUrls(a);
  return u.url && u.previewUrl ? `${u.previewUrl} 400w, ${u.url} ${fullWidth}w` : undefined;
}

export function posterSrcSet(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (parseImageRef(path).source !== "tmdb") return previewAndOriginal(path, 1000);
  return (["w185", "w342", "w500", "w780"] as const).map((s) => `${tmdbImage(path, s)} ${s.slice(1)}w`).join(", ");
}

/**
 * Backdrops up to TMDB's 1920 px copy; the original (usually 3840 px, 1–3 MB) only for screens that
 * need more than 1920 device pixels. Labelling the original 1920w made every 1080p screen and TV
 * download and decode 4K art.
 */
export function backdropSrcSet(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (parseImageRef(path).source !== "tmdb") return previewAndOriginal(path, 1920);
  return (["w780", "w1280", "w1920", "original"] as const)
    .map((s) => `${tmdbImage(path, s)} ${s === "original" ? "3840" : s.slice(1)}w`)
    .join(", ");
}

/**
 * The width a hero's backdrop is drawn at, for its srcSet: 80 % of the window beside
 * the text (from md on a screen no taller than 5:4 — globals.css `art-over`), the window's width as a band above it.
 * Beside the text that is no more than 1280 px below 1600 px windows, as before: TMDB's 1280 copy is as sharp to the eye
 * there as the 1920 one and a third of its weight (the billboard is the home page's largest paint). A band
 * on a portrait tablet used to be drawn 1.67 times its 768 px — sized for the window, stretched to the billboard's height.
 */
export const BACKDROP_SIZES = "(min-width: 48rem) and (min-aspect-ratio: 5/4) 80vw, 100vw";

/**
 * Asks for the page's first backdrop from the document's head (React's preload), so the browser fetches it with the
 * styles and fonts instead of when its <img> comes up in the HTML — the largest paint of home, a section and a title.
 */
export function preloadBackdrop(path: string | null | undefined) {
  const href = tmdbImage(path, "w1280");
  if (href) preload(href, { as: "image", imageSrcSet: backdropSrcSet(path), imageSizes: BACKDROP_SIZES, fetchPriority: "high" });
}
