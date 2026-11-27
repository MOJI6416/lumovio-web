import type { MediaKind } from "@lumovio/contracts";

/** URL-friendly slug that keeps non-Latin scripts readable (Cyrillic, CJK…). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip accents from Latin letters only (é → e); Cyrillic й/ё keep their marks.
    .replace(/([a-zA-Z])[\u0300-\u036f]+/g, "$1")
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * What a title's addresses are built from: its own code — and TMDB's kind and id for an answer without one, whose
 * address (`/title/movie/603`) the site moves to the code's for good.
 */
export interface TitleRef {
  code?: string | null;
  kind: MediaKind;
  tmdbId: number;
  title?: string | null;
}

/** A title's page: its code and its name in the page's language (`/title/ewzsjd5z-matrica`). */
export function titleHref(t: TitleRef, name: string | null | undefined = t.title): string {
  const slug = name ? slugify(name) : "";
  const base = t.code ? `/title/${t.code}` : `/title/${t.kind}/${t.tmdbId}`;
  return `${base}${slug ? `-${slug}` : ""}`;
}

/**
 * A person's address is the code alone: their name is spelled differently by language (Latin on TMDB, localized
 * here), and one address per person keeps every link and the canonical the same. An answer without the code links
 * TMDB's id, which moves to the code's address.
 */
export function personHref(p: { code?: string | null; id: number }): string {
  return `/person/${p.code ?? p.id}`;
}

/** What the player's address may say: the episode, the copy, the dubbing and the rest, as WatchView reads them. */
export type WatchQuery = Partial<Record<"s" | "e" | "source" | "voice" | "audio" | "quality" | "picture" | "edition" | "t" | "cast" | "pick" | "added" | "brought", string | number | null>>;

/** The player's page for a title (`/watch/ewzsjd5z?s=1&e=2`); empty values are left out, the rest in the order given. */
export function watchHref(t: Pick<TitleRef, "code" | "kind" | "tmdbId">, query: WatchQuery = {}): string {
  const base = t.code ? `/watch/${t.code}` : `/watch/${t.kind}/${t.tmdbId}`;
  const q = Object.entries(query)
    .filter((e): e is [string, string | number] => e[1] !== null && e[1] !== undefined && e[1] !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `${base}?${q}` : base;
}
