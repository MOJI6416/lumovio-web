/**
 * Where pictures are served from, by their source — the one setting every image address of the site and the API is
 * built from. Lumovio keeps no image files: a picture is a path in its source's store (TMDB's file path, fanart.tv's
 * file under its CDN) and its address is the source's host, the size a slot needs and that path. Serving a source's
 * pictures from elsewhere (another CDN, a bucket holding the same sizes under the same paths) is a change of its `base`
 * here.
 *
 * In API answers a picture is a string: TMDB's file path as TMDB gives it ("/abc.jpg"), or another source's path after
 * its name ("fanart:/movies/603/hdmovielogo/the-matrix.png").
 *
 * Kept free of other imports so the site's pages can import it without the rest of the contracts.
 */

export interface ImageSourceSetting {
  base: string;
  /** The segment of the address for a size the site asks for: TMDB's size names (w92 … w1920, h632, original) or `preview`. */
  segment: (size: string) => string;
}

const widthOf = (size: string) => {
  const m = /^[wh](\d+)$/.exec(size);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
};

export const IMAGE_SOURCES = {
  /** TMDB's CDN in each of its own sizes. */
  tmdb: { base: "https://image.tmdb.org/t/p", segment: (size: string) => size },
  /** fanart.tv's CDN: its ≤400 px copy for small slots, else the original file. */
  fanart: { base: "https://assets.fanart.tv", segment: (size: string) => (size === "preview" || widthOf(size) <= 400 ? "bigpreview" : "fanart") },
} as const satisfies Record<string, ImageSourceSetting>;

export type ImageSource = keyof typeof IMAGE_SOURCES;

export const isImageSource = (s: string): s is ImageSource => Object.hasOwn(IMAGE_SOURCES, s);

/** A picture as API answers carry it (see above). */
export const imageRef = (source: ImageSource, path: string): string => (source === "tmdb" ? path : `${source}:${path}`);

/** A picture's source and path; anything without a known source's name is TMDB's file path, as answers have always given it. */
export function parseImageRef(ref: string): { source: ImageSource; path: string } {
  const m = /^([a-z][a-z0-9_]*):(\/.*)$/.exec(ref);
  const name = m?.[1];
  return name && isImageSource(name) ? { source: name, path: m[2]! } : { source: "tmdb", path: ref };
}

/** The address of a source's file in a size. */
export const sourceUrl = (source: ImageSource, path: string, size: string): string => {
  const s: ImageSourceSetting = IMAGE_SOURCES[source];
  return `${s.base}/${s.segment(size)}${path}`;
};

/** The address of a picture (see above) in a size; null without one. */
export function imageUrl(ref: string | null | undefined, size: string): string | null {
  if (!ref) return null;
  const { source, path } = parseImageRef(ref);
  return sourceUrl(source, path, size);
}

/**
 * A fanart.tv file's path in its store, from its address: the one fanart.tv's own answers give
 * ("https://assets.fanart.tv/fanart/…") or one built here.
 */
export function fanartPath(url: string): string | null {
  for (const base of [IMAGE_SOURCES.fanart.base, "https://assets.fanart.tv"]) {
    const prefix = `${base}/fanart/`;
    if (url.startsWith(prefix)) return url.slice(prefix.length - 1);
  }
  return null;
}
